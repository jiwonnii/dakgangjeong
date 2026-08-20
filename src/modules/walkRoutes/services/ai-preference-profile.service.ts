import OpenAI from "openai";
import { env } from "../../../config/env";
import { TtlCache } from "../../../lib/ttl-cache";
import { reviewFactorSchema } from "../../walkRecords/walk-record.schemas";

export type AiPreferenceFactorKey = (typeof reviewFactorSchema)["options"][number];

export type AiPreferenceRecord = {
  rating: number | null;
  liked_factor: string | null;
  disliked_factor: string | null;
  liked_notes: string | null;
  disliked_notes: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  recommended_course: unknown | null;
};

export type AiPreferenceSignal = {
  factor: AiPreferenceFactorKey;
  polarity: "liked" | "disliked" | "mentioned";
  strength: number;
  confidence: number;
  reason: string;
};

export type AiPreferenceProfile = {
  signals: AiPreferenceSignal[];
  insight: string | null;
};

const FACTOR_KEYS = reviewFactorSchema.options;
const FACTOR_SET = new Set<string>(FACTOR_KEYS);
const PREFERENCE_MODEL = "gpt-4.1-mini";
const PREFERENCE_TIMEOUT_MS = 8000;
const PREFERENCE_RECORD_LIMIT = 12;

const preferenceCache = new TtlCache<string, AiPreferenceProfile>(60 * 60, 500);
let openAiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  openAiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openAiClient;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 300) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function summarizeRecommendedCourse(value: unknown): Record<string, unknown> | null {
  const course = asRecord(value);

  if (!course) {
    return null;
  }

  const facts = asRecord(course.facts);
  const explanation = asRecord(course.explanation);
  const factors = Array.isArray(explanation?.factors)
    ? explanation.factors
        .map(asRecord)
        .filter((factor): factor is Record<string, unknown> => factor !== null)
        .slice(0, 6)
        .map((factor) => ({
          key: factor.key,
          label: factor.label,
          score: factor.score,
          weight: factor.weight,
          contribution: factor.contribution
        }))
    : [];

  return {
    rank: course.rank,
    courseName: course.courseName,
    direction: course.direction,
    distanceMeters: course.distanceMeters,
    durationMinutes: course.durationMinutes,
    score: course.score,
    facts: facts
      ? {
          riskZoneCount: facts.riskZoneCount,
          vehicleExposure: facts.vehicleExposure,
          stepsCount: facts.stepsCount,
          parkRatio: facts.parkRatio,
          treesPerKm: facts.treesPerKm,
          benchCount: facts.benchCount
        }
      : null,
    factors
  };
}

function compactRecord(row: AiPreferenceRecord): Record<string, unknown> {
  return {
    rating: row.rating,
    likedFactor: row.liked_factor,
    dislikedFactor: row.disliked_factor,
    likedNotes: normalizeText(row.liked_notes),
    dislikedNotes: normalizeText(row.disliked_notes),
    distanceMeters: row.distance_meters,
    durationMinutes:
      row.duration_seconds !== null ? Math.round(row.duration_seconds / 60) : null,
    recommendedCourse: summarizeRecommendedCourse(row.recommended_course)
  };
}

function buildCacheKey(records: readonly AiPreferenceRecord[]): string {
  return JSON.stringify(records.slice(0, PREFERENCE_RECORD_LIMIT).map(compactRecord));
}

function factorEnumSchema() {
  return {
    type: "string" as const,
    enum: [...FACTOR_KEYS]
  };
}

function normalizeSignal(value: unknown): AiPreferenceSignal | null {
  const signal = asRecord(value);

  if (!signal || typeof signal.factor !== "string" || !FACTOR_SET.has(signal.factor)) {
    return null;
  }

  const polarity =
    signal.polarity === "liked" || signal.polarity === "disliked" || signal.polarity === "mentioned"
      ? signal.polarity
      : "mentioned";

  return {
    factor: signal.factor as AiPreferenceFactorKey,
    polarity,
    strength: clamp01(Number(signal.strength)),
    confidence: clamp01(Number(signal.confidence)),
    reason: typeof signal.reason === "string" ? signal.reason.trim().slice(0, 120) : ""
  };
}

function parseProfile(outputText: string): AiPreferenceProfile {
  const parsed = JSON.parse(outputText) as { signals?: unknown[]; insight?: unknown };
  const signals = Array.isArray(parsed.signals)
    ? parsed.signals
        .map(normalizeSignal)
        .filter((signal): signal is AiPreferenceSignal => signal !== null)
        .filter((signal) => signal.strength > 0 && signal.confidence > 0)
        .slice(0, 4)
    : [];
  const insight = typeof parsed.insight === "string" ? parsed.insight.trim().slice(0, 160) : "";

  return {
    signals,
    insight: insight || null
  };
}

async function inferAiPreferenceProfileUncached(
  records: readonly AiPreferenceRecord[]
): Promise<AiPreferenceProfile> {
  const client = getOpenAiClient();
  const compactRecords = records.slice(0, PREFERENCE_RECORD_LIMIT).map(compactRecord);
  const hasUsableRecord = compactRecords.some(
    (record) =>
      record.rating ||
      record.likedNotes ||
      record.dislikedNotes ||
      record.likedFactor ||
      record.dislikedFactor ||
      record.recommendedCourse
  );

  if (!client || !hasUsableRecord) {
    return { signals: [], insight: null };
  }

  try {
    const response = await client.responses.create(
      {
        model: PREFERENCE_MODEL,
        input: [
          {
            role: "system",
            content:
              "You infer a dog's walking-route preference profile from recent walk records for a recommendation engine. " +
              "Return only signals that can improve ranking among these exact factor keys: riskZones, vehicleExposure, pedestrianSafety, environment, familiarity, fit. " +
              "Interpret liked notes, disliked notes, ratings, and the selected recommended course together. " +
              "A liked signal means the dog/guardian seemed satisfied with that factor. A disliked signal means that factor caused dissatisfaction and should be weighted more strictly in future ranking. " +
              "A mentioned signal means the factor was important but the direction is mixed. Do not invent facts beyond the records. Prefer fewer high-confidence signals over weak guesses."
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedFactors: [...FACTOR_KEYS],
              recentRecords: compactRecords
            })
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "walk_preference_profile",
            schema: {
              type: "object",
              properties: {
                signals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      factor: factorEnumSchema(),
                      polarity: {
                        type: "string",
                        enum: ["liked", "disliked", "mentioned"]
                      },
                      strength: {
                        type: "number",
                        description: "0 to 1. How strongly this factor should affect future ranking."
                      },
                      confidence: {
                        type: "number",
                        description: "0 to 1. How clearly the records support this signal."
                      },
                      reason: {
                        type: "string",
                        description: "Short Korean reason grounded in the records."
                      }
                    },
                    required: ["factor", "polarity", "strength", "confidence", "reason"],
                    additionalProperties: false
                  }
                },
                insight: {
                  type: ["string", "null"],
                  description: "One short Korean sentence summarizing the strongest preference signal, or null."
                }
              },
              required: ["signals", "insight"],
              additionalProperties: false
            },
            strict: true
          }
        },
        max_output_tokens: 500
      },
      { timeout: PREFERENCE_TIMEOUT_MS }
    );

    return parseProfile(response.output_text);
  } catch (error) {
    console.warn(
      "[ai-preference-profile.service] Falling back to explicit review signals after AI preference inference failed:",
      error instanceof Error ? error.message : error
    );
    return { signals: [], insight: null };
  }
}

export async function inferAiPreferenceProfile(
  records: readonly AiPreferenceRecord[]
): Promise<AiPreferenceProfile> {
  if (records.length === 0) {
    return { signals: [], insight: null };
  }

  return preferenceCache.getOrCompute(buildCacheKey(records), () =>
    inferAiPreferenceProfileUncached(records)
  );
}
