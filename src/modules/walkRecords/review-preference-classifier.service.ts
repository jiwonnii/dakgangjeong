/**
 * Free-text-to-factor classifier for walk review notes.
 *
 * The preference-learning pipeline in
 * `walkRoutes/services/recommendation.service.ts` (`loadReviewPreferenceSummary` /
 * `summarizeReviewPreferences`) only re-ranks future course recommendations
 * using the `liked_factor` / `disliked_factor` columns on `walk_records`.
 * Those columns are populated when a user explicitly picks a category from
 * the review dropdown, but many users only type free text
 * (`likedNotes` / `dislikedNotes`) and skip the dropdown, so the pipeline
 * misses that signal entirely.
 *
 * This module reads that free text with the OpenAI Responses API and maps
 * it onto the SAME 6-value `reviewFactorSchema` enum the rest of the app
 * already understands, so a user who only wrote a note still feeds the
 * existing learning pipeline. It never invents new categories, and if the
 * note doesn't clearly map to one of the 6, it returns null rather than
 * forcing a guess — `isReviewFactorKey`/`summarizeReviewPreferences`
 * already correctly no-op on null factors, so a null result simply means
 * "no signal from this note," matching the product intent of excluding
 * unrelated notes from future recommendation weighting.
 *
 * This is a best-effort enhancement, not a hard dependency: if
 * `OPENAI_API_KEY` isn't configured, there's no note text to classify, or
 * the OpenAI call fails/times out/returns something unparseable, this
 * resolves to `{ likedFactor: null, dislikedFactor: null }` instead of
 * throwing — finishing/saving a walk record must never fail because
 * OpenAI is unavailable or misbehaves.
 */

import OpenAI from "openai";
import { env } from "../../config/env";
import { reviewFactorSchema } from "./walk-record.schemas";

export type ReviewFactorKey = (typeof reviewFactorSchema)["options"][number];

const REVIEW_FACTOR_KEYS = reviewFactorSchema.options;
const REVIEW_FACTOR_SET = new Set<string>(REVIEW_FACTOR_KEYS);

/** Short Korean labels for the 6 factor keys, given to the model as
 * context. Kept in sync in wording with recommendation.service.ts's
 * `REVIEW_FACTOR_LABELS` (used for the user-facing preference insight
 * sentence), duplicated here rather than imported so this classifier has
 * no dependency on the recommendation pipeline module. */
const REVIEW_FACTOR_PROMPT_LABELS: Record<ReviewFactorKey, string> = {
  riskZones: "사고다발/위험구간",
  vehicleExposure: "차량 노출",
  pedestrianSafety: "보행 위험(계단 등)",
  environment: "공원/가로수/벤치",
  familiarity: "익숙함/새로움",
  fit: "거리/시간 적합도"
};

const CLASSIFIER_TIMEOUT_MS = 6000;
const CLASSIFIER_MODEL = "gpt-4.1-mini";

export type ClassifyReviewFactorsInput = {
  likedNotes?: string;
  dislikedNotes?: string;
};

export type ClassifyReviewFactorsResult = {
  likedFactor: ReviewFactorKey | null;
  dislikedFactor: ReviewFactorKey | null;
};

const NULL_RESULT: ClassifyReviewFactorsResult = { likedFactor: null, dislikedFactor: null };

let openAiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  openAiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openAiClient;
}

function factorEnumSchema() {
  return {
    type: ["string", "null"] as const,
    enum: [...REVIEW_FACTOR_KEYS, null]
  };
}

function normalizeFactor(value: unknown): ReviewFactorKey | null {
  return typeof value === "string" && REVIEW_FACTOR_SET.has(value) ? (value as ReviewFactorKey) : null;
}

/**
 * Best-effort classification of free-text walk review notes into the
 * shared 6-value review factor enum. Never throws — any failure (no API
 * key, no notes, request error, timeout, or unparseable/invalid model
 * output) resolves to `{ likedFactor: null, dislikedFactor: null }`.
 */
export async function classifyReviewFactors(
  input: ClassifyReviewFactorsInput
): Promise<ClassifyReviewFactorsResult> {
  const likedNotes = input.likedNotes?.trim() || undefined;
  const dislikedNotes = input.dislikedNotes?.trim() || undefined;

  if (!likedNotes && !dislikedNotes) {
    return NULL_RESULT;
  }

  const client = getOpenAiClient();

  if (!client) {
    return NULL_RESULT;
  }

  try {
    const response = await client.responses.create(
      {
        model: CLASSIFIER_MODEL,
        input: [
          {
            role: "system",
            content:
              "You classify short Korean free-text feedback about a dog walk into a fixed set of categories for a walk-route recommendation app. " +
              "The 6 allowed category keys and what each means:\n" +
              Object.entries(REVIEW_FACTOR_PROMPT_LABELS)
                .map(([key, label]) => `- ${key}: ${label}`)
                .join("\n") +
              "\n\nFor the liked note, pick the single category key that best matches what the user liked, or null if it doesn't clearly relate to any of the 6 categories. " +
              "For the disliked note, pick the single category key that best matches what the user disliked, or null if it doesn't clearly relate to any of the 6 categories. " +
              "Only use the 6 exact keys given above (or null). Do not invent new categories. When in doubt, prefer null over a weak guess."
          },
          {
            role: "user",
            content: JSON.stringify({ likedNotes: likedNotes ?? null, dislikedNotes: dislikedNotes ?? null })
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "review_factor_classification",
            schema: {
              type: "object",
              properties: {
                likedFactor: factorEnumSchema(),
                dislikedFactor: factorEnumSchema()
              },
              required: ["likedFactor", "dislikedFactor"],
              additionalProperties: false
            },
            strict: true
          }
        },
        max_output_tokens: 200
      },
      { timeout: CLASSIFIER_TIMEOUT_MS }
    );

    const parsed = JSON.parse(response.output_text) as {
      likedFactor?: unknown;
      dislikedFactor?: unknown;
    };

    return {
      likedFactor: likedNotes ? normalizeFactor(parsed.likedFactor) : null,
      dislikedFactor: dislikedNotes ? normalizeFactor(parsed.dislikedFactor) : null
    };
  } catch (error) {
    console.warn(
      "[review-preference-classifier] Falling back to no signal after classification failure:",
      error instanceof Error ? error.message : error
    );
    return NULL_RESULT;
  }
}
