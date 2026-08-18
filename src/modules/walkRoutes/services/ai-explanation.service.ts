import OpenAI from "openai";
import { env } from "../../../config/env";
import { TtlCache } from "../../../lib/ttl-cache";

type ExplainableCourse = {
  rank: number;
  direction: string;
  distanceMeters: number;
  durationMinutes: number;
  score: number;
  facts?: {
    riskZoneCount?: number;
    vehicleExposure?: number | null;
    stepsCount?: number;
    parkRatio?: number;
    treesPerKm?: number;
    benchCount?: number;
  };
  explanation?: {
    summary?: string;
    factors?: Array<{
      key: string;
      label: string;
      score?: number;
      weight?: number;
      contribution?: number;
      detail?: string;
      preferenceAdjustment?: number;
    }>;
  };
  preferenceInsight?: string | null;
};

/** Change 7 (2026-08-14): both the prose explanation and the short course
 * name now come out of the same OpenAI call (or the same rule-based
 * fallback), so both are cached and returned together. */
type ExplanationResult = {
  aiExplanation: string;
  courseName: string;
};

/** Max Korean characters for a course display name (Change 7). Enforced
 * here regardless of what the model returns — never trust the model to
 * respect a length instruction exactly. Uses Array.from so it counts
 * Unicode code points, not UTF-16 code units (matters for characters
 * outside the BMP; harmless overkill for plain Hangul, which is one code
 * unit per syllable anyway). */
const COURSE_NAME_MAX_CHARS = 8;

function truncateCourseName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();

  if (trimmed.length === 0) {
    return "새로운 코스";
  }

  const chars = Array.from(trimmed);
  return chars.length <= COURSE_NAME_MAX_CHARS ? trimmed : chars.slice(0, COURSE_NAME_MAX_CHARS).join("");
}

/** 공원 비율(parkRatio)이 이 이상이면 "공원 많은 길"로 이름 붙일 만큼
 * 뚜렷하다고 본다. 명세에 숫자가 없어 직접 정한 값. */
const PARK_RATIO_NAME_THRESHOLD = 0.3;
/** 가로수 밀도(treesPerKm)가 이 이상이면 "나무 많은 길". */
const TREES_PER_KM_NAME_THRESHOLD = 25;
/** 차량 노출도(0~5)가 이 이하고 위험구간이 없으면 "차 없는 길". */
const LOW_VEHICLE_EXPOSURE_NAME_THRESHOLD = 1.5;
/** 벤치 개수가 이 이상이면 "쉼터 있는 길". */
const BENCH_COUNT_NAME_THRESHOLD = 3;

/**
 * Change 7 (2026-08-14): deterministic fallback for when there's no OpenAI
 * API key configured (or the call fails) — names a course after whichever
 * *positive* trait is most distinctive, deliberately skipping negative
 * traits (e.g. never names a course after a high riskZoneCount) so this
 * never reads as a warning. Falls back to the existing compass-direction
 * label ("{direction} 방향 코스") when nothing clears a threshold, so a
 * name is never empty.
 */
function fallbackCourseName(course: ExplainableCourse): string {
  const facts = course.facts ?? {};
  const parkRatio = facts.parkRatio ?? 0;
  const treesPerKm = facts.treesPerKm ?? 0;
  const vehicleExposure = facts.vehicleExposure ?? null;
  const benchCount = facts.benchCount ?? 0;
  const riskZoneCount = facts.riskZoneCount ?? 0;

  if (parkRatio >= PARK_RATIO_NAME_THRESHOLD) {
    return "공원 많은 길";
  }

  if (vehicleExposure !== null && vehicleExposure <= LOW_VEHICLE_EXPOSURE_NAME_THRESHOLD && riskZoneCount === 0) {
    return "차 없는 길";
  }

  if (treesPerKm >= TREES_PER_KM_NAME_THRESHOLD) {
    return "나무 많은 길";
  }

  if (benchCount >= BENCH_COUNT_NAME_THRESHOLD) {
    return "쉼터 있는 길";
  }

  return truncateCourseName(`${course.direction} 방향 코스`);
}

const explanationCache = new TtlCache<string, ExplanationResult>(60 * 60, 1000);
let openAiClient: OpenAI | null = null;

function fallbackExplanation(course: ExplainableCourse) {
  const facts = course.facts;
  const risk = facts?.riskZoneCount ?? 0;
  const vehicle = facts?.vehicleExposure ?? "보수값";
  const steps = facts?.stepsCount ?? 0;

  return (
    course.explanation?.summary ??
    `${course.rank}순위 코스는 위험구간 ${risk}회, 차량 노출 ${vehicle}, 계단 ${steps}개를 기준으로 안전 우선 정렬 뒤 선택됐어요.`
  );
}

function cacheKey(course: ExplainableCourse) {
  return JSON.stringify({
    rank: course.rank,
    direction: course.direction,
    distanceMeters: course.distanceMeters,
    durationMinutes: course.durationMinutes,
    score: course.score,
    facts: course.facts,
    factors: course.explanation?.factors,
    preferenceInsight: course.preferenceInsight
  });
}

function getOpenAiClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  openAiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openAiClient;
}

/**
 * Change 7 (2026-08-14): this single call now returns BOTH the prose
 * explanation and a short course name, via Structured Outputs on the
 * Responses API (`text.format: { type: "json_schema", ... }` — this is the
 * openai@6.10.0 shape; older SDK versions used `response_format` instead).
 * `strict: true` makes the model's output conform to the schema, but the
 * courseName length is still defensively re-validated/truncated in code
 * below (truncateCourseName) rather than trusted — a model can still return
 * a name longer than 8 Korean characters even under a string-only schema,
 * since JSON Schema's `maxLength` counts UTF-16 units, not the "8 Korean
 * characters" the product actually wants.
 */
async function explainWithOpenAi(course: ExplainableCourse): Promise<ExplanationResult> {
  const client = getOpenAiClient();
  const fallbackName = fallbackCourseName(course);

  if (!client) {
    return { aiExplanation: fallbackExplanation(course), courseName: fallbackName };
  }

  const facts = course.facts ?? {};

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You write concise Korean UX copy for a dog walking route app. Use only the normalized facts and scoring factors provided. Do not change ranking, score, or facts. Explain why this already-ranked course is reasonable and include one practical caution when useful. Also invent a short, positive, feature-based Korean display name for this specific course (e.g. '공원 많은 길', '조용한 골목길') describing what's distinctive about it — never name it after a bad trait like high risk zones. The name must be at most 8 Korean characters."
        },
        {
          role: "user",
          content: JSON.stringify({
            rank: course.rank,
            direction: course.direction,
            distanceMeters: course.distanceMeters,
            durationMinutes: course.durationMinutes,
            score: course.score,
            riskZoneCount: facts.riskZoneCount,
            vehicleExposure: facts.vehicleExposure,
            stepsCount: facts.stepsCount,
            parkRatio: facts.parkRatio,
            treesPerKm: facts.treesPerKm,
            benchCount: facts.benchCount,
            existingSummary: course.explanation?.summary,
            scoringFactors: course.explanation?.factors?.map((factor) => ({
              key: factor.key,
              label: factor.label,
              score: factor.score,
              weight: factor.weight,
              contribution: factor.contribution,
              detail: factor.detail,
              preferenceAdjustment: factor.preferenceAdjustment
            })),
            recentReviewPreference: course.preferenceInsight
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "course_explanation",
          schema: {
            type: "object",
            properties: {
              explanation: {
                type: "string",
                description: "1-3 sentence Korean prose explanation of why this course is reasonable."
              },
              courseName: {
                type: "string",
                description: "Short positive Korean course display name, at most 8 Korean characters."
              }
            },
            required: ["explanation", "courseName"],
            additionalProperties: false
          },
          strict: true
        }
      },
      max_output_tokens: 220
    });

    const raw = response.output_text.trim();
    const parsed = raw ? (JSON.parse(raw) as { explanation?: string; courseName?: string }) : {};
    const aiExplanation = parsed.explanation?.trim() || fallbackExplanation(course);
    const courseName = truncateCourseName(parsed.courseName || fallbackName);

    return { aiExplanation, courseName };
  } catch (error) {
    console.error("[ai-explanation.service] OpenAI structured explanation failed:", error);
    return { aiExplanation: fallbackExplanation(course), courseName: fallbackName };
  }
}

export async function addAiExplanationsToCourses<T extends ExplainableCourse>(
  courses: T[]
): Promise<Array<T & { aiExplanation: string; courseName: string }>> {
  return Promise.all(
    courses.map(async (course) => {
      const result = await explanationCache
        .getOrCompute(cacheKey(course), () => explainWithOpenAi(course))
        .catch(() => ({
          aiExplanation: fallbackExplanation(course),
          courseName: fallbackCourseName(course)
        }));

      return {
        ...course,
        aiExplanation: result.aiExplanation,
        courseName: truncateCourseName(result.courseName)
      };
    })
  );
}
