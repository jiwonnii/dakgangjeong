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

const explanationCache = new TtlCache<string, string>(60 * 60, 1000);
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

async function explainWithOpenAi(course: ExplainableCourse) {
  const client = getOpenAiClient();

  if (!client) {
    return fallbackExplanation(course);
  }

  const facts = course.facts ?? {};

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You write concise Korean UX copy for a dog walking route app. Use only the normalized facts and scoring factors provided. Do not change ranking, score, or facts. Explain why this already-ranked course is reasonable and include one practical caution when useful."
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
    max_output_tokens: 180
  });

  return response.output_text.trim() || fallbackExplanation(course);
}

export async function addAiExplanationsToCourses<T extends ExplainableCourse>(
  courses: T[]
): Promise<Array<T & { aiExplanation: string }>> {
  return Promise.all(
    courses.map(async (course) => {
      const aiExplanation = await explanationCache
        .getOrCompute(cacheKey(course), () => explainWithOpenAi(course))
        .catch(() => fallbackExplanation(course));

      return {
        ...course,
        aiExplanation
      };
    })
  );
}
