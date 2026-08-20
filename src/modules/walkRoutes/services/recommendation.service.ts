/**
 * Orchestrates the full 추천 로직 (spec 5, "전체 흐름"): the single entry
 * point every round 1-9 module ultimately feeds into.
 *
 *   ① 경고 체크         warning-check.ts + weather/air-quality providers
 *   ② 목표 시간 계산     target-duration.ts
 *   ③ 방위 선정         bearing-selection.ts + bearing.service.ts
 *   ④ 코스 생성         route-generation.service.ts
 *   ⑤ 사후 채점         scoring.service.ts
 *   ⑥ 성격 가중치       scoring-weighted.ts (breakdown/설명용)
 *   ⑦ 최종 3개 선정     course-selection.ts, ordered by scoring-weighted.ts totalScore
 *
 * Final ordering now uses scoring-weighted.ts's totalScore, so rank, score,
 * scoreDetails, and explanation all describe the same decision.
 *
 * Previously this used scoring-filter.ts's
 * rankByHierarchicalFilter (안전이 다른 축으로 상쇄될 수 없는 사전식
 * 정렬), not scoring-weighted.ts's totalScore — round-9 verification found
 * a concrete case where the spec's own literal 3축 가중치 (40:30:30)
 * lets a busier, more dangerous road outrank a quieter one because of a
 * large tree-density gap, which directly contradicts spec 5.6's own
 * stated principle ("안전은 다른 항목으로 상쇄될 수 없어야 한다"). The
 * weighted breakdown is still computed and attached to every returned
 * course, because spec 5.7's response shape and the AI explanation layer
 * need real safety/comfort/fit numbers — it drives *what is shown*, not
 * *what wins*. This is a judgment call flagged to the user rather than
 * decided silently; see the round-9/10 conversation for the alternative
 * weight tables considered.
 */

import { getSupabaseAdminClient } from "../../../lib/supabase";
import { AppError } from "../../../lib/app-error";
import { gridKeyForPoint, type LatLon } from "../../../lib/geo";
import { getKstHour } from "../../../lib/kst-time";
import { resolveTimeOfDayBucket } from "../../../lib/kst-time";
import { TtlCache } from "../../../lib/ttl-cache";
import { findDogBreedById } from "../../dogs/dog-breed.service";
import {
  BEARING_GRID_CELL_SIZE_M,
  EVENING_OR_NIGHT_END_HOUR,
  EVENING_OR_NIGHT_START_HOUR,
  MORNING_END_HOUR,
  RECOMMENDATION_CACHE_TTL_SECONDS,
  VEHICLE_EXPOSURE_MAX
} from "../../../constants/walk-tuning";
import { normalizeDogProfile, type DogProfile } from "../domain/dog-profile";
import { calculateTargetDuration, type DurationOptions } from "../domain/target-duration";
import { evaluateWarnings, type WarningEvaluation, type WeatherSnapshot } from "../domain/warning-check";
import { getWeatherSnapshot } from "../providers/weather.provider";
import { getAirQualitySnapshot } from "../providers/air-quality.provider";
import { verifyPedestrianRoute } from "../providers/tmap.provider";
import { getRoadCountsByBearing } from "./bearing.service";
import { isCoverageSufficient, selectTopBearings } from "../domain/bearing-selection";
import { generateRouteCandidates, type RouteGenerationFailure } from "./route-generation.service";
import { fetchOriginContext, scoreRouteCandidates, type CourseFacts, type OriginContext } from "./scoring.service";
import { applyHardFilters } from "../domain/scoring-filter";
import { rankByWeightedScore, type ScoredCourse, type ScoreBreakdown } from "../domain/scoring-weighted";
import { selectFinalCourses } from "../domain/course-selection";
import {
  inferAiPreferenceProfile,
  type AiPreferenceProfile,
  type AiPreferenceSignal
} from "./ai-preference-profile.service";
import type { DogPersonalityTag, DogSocialPreference, DurationChoice } from "../../../types/domain";

export type RecommendationRequest = {
  dogId: string;
  origin: LatLon;
  durationChoice: DurationChoice;
  /** Required and validated against [minimumMinutes, maximumMinutes] when
   * durationChoice is "custom" (spec 5.2 "직접 설정 = 최소~상한 사이 자유"). */
  customMinutes?: number;
  /**
   * "다시 추천받기" 용. 캐시 읽기를 건너뛰고 코스 생성 시드를 새로 뽑는다.
   *
   * 이게 없으면 같은 출발지·같은 시간대에서는 캐시 TTL(6시간) 내내 똑같은
   * 코스 3개가 돌아와서 버튼이 아무 일도 안 하는 것처럼 보인다. 결과는
   * 캐시에 다시 써서, 이어지는 일반 요청은 새로 뽑은 코스를 받는다.
   */
  refresh?: boolean;
};

export type RecommendedCourseFacts = {
  vehicleExposure: number | null;
  parkRatio: number;
  treesPerKm: number;
  riskZoneCount: number;
  benchCount: number;
  dogEncounterProbability: number;
  /** Null until the round-12 TMAP background verification pass (see
   * `enrichCoursesWithTmapInBackground` below) fills it in — deliberately
   * absent from the synchronous response (spec 7.3: TMAP은 파이프라인에
   * 포함하지 않음). A client that wants the confirmed count can re-request
   * the same recommendation shortly after; it will come back from cache
   * with this field populated once enrichment finishes. */
  crosswalkCount: number | null;
  /** Starts as the PostGIS road_segments-based estimate (round 8/9);
   * overwritten with TMAP's real facility count once verification
   * finishes, since TMAP's routing-engine data is the more authoritative
   * source when available. */
  stepsCount: number;
  /** ISO timestamp of when TMAP verification completed for this course,
   * or null if it hasn't (yet, or the background pass failed for this
   * course specifically — see enrichCoursesWithTmapInBackground's
   * per-course error isolation). */
  tmapVerifiedAt: string | null;
};

export type RecommendedCourseScoreDetails = {
  riskZones: number;
  vehicleExposure: number;
  pedestrianSafety: number;
  environment: number;
  familiarity: number;
  fit: number;
};

export type RecommendedCourseExplanation = {
  summary: string;
  factors: Array<{
    key: keyof RecommendedCourseScoreDetails;
    label: string;
    score: number;
    weight: number;
    contribution: number;
    detail: string;
    preferenceAdjustment?: number;
  }>;
};

export type RecommendedCourse = {
  rank: number;
  direction: string;
  distanceMeters: number;
  durationMinutes: number;
  score: number;
  breakdown: Pick<ScoreBreakdown, "safety" | "comfort" | "fit">;
  scoreDetails: RecommendedCourseScoreDetails;
  explanation: RecommendedCourseExplanation;
  /** Change 2/8 (2026-08-14): short, concrete practical cautions for this
   * specific course (risk zones, vehicle exposure, stairs for a
   * stair-avoiding dog, etc.) — built by buildCourseCautions. Meant to
   * replace the raw score/weight/contribution breakdown as what's shown to
   * the end user in course-results.tsx's "이 코스 산책 시 고려사항" panel.
   * Can be empty when nothing notable applies. */
  cautions: string[];
  /** Change 7 (2026-08-14): short feature-based display name (max 8
   * Korean characters), e.g. "공원 많은 길". NOT populated here — it is
   * added downstream by addAiExplanationsToCourses (ai-explanation.service
   * .ts), the same place aiExplanation is added, since both come from the
   * same OpenAI call (or the same rule-based fallback when no API key is
   * configured). Declared optional here purely so this type documents the
   * full shape a client can expect after that step runs. */
  courseName?: string;
  preferenceInsight?: string | null;
  facts: RecommendedCourseFacts;
  path: { type: "LineString"; coordinates: [number, number][] };
};

export type RecommendationResult =
  | { status: "insufficient_coverage"; message: string }
  | { status: "generation_failed"; message: string; failures: RouteGenerationFailure[] }
  | { status: "no_courses_found"; message: string }
  | {
      status: "ok";
      courses: RecommendedCourse[];
      warnings: WarningEvaluation["warnings"];
      durationOptions: DurationOptions;
      /** True when every candidate missed the target-distance tolerance and
       * this response is the closest-available fallback instead of a
       * tolerance-passing match (see applyHardFilters's
       * enforceDistanceTolerance param) — the client should say something
       * like "요청하신 시간과 정확히 맞진 않지만" rather than presenting
       * these as an exact match. */
      distanceApproximate?: boolean;
      /** True when none of the final selected courses landed within
       * DURATION_CLOSENESS_TOLERANCE_MINUTES of the resolved target — the
       * duration-closeness preference (see applyDurationClosenessPreference)
       * is a soft re-ranking signal, not a hard filter, so this can still
       * happen when every hard-filtered candidate is far from the target
       * duration. Optional so it never breaks existing consumers; the
       * client can use it for messaging like "정확한 시간대의 코스를 찾지
       * 못해 가장 가까운 코스를 보여드려요" in the future. */
      durationApproximate?: boolean;
    };

const recommendationCache = new TtlCache<string, RecommendationResult>(
  RECOMMENDATION_CACHE_TTL_SECONDS
);

const RECOMMENDATION_CACHE_VERSION = "route-score-v7-ai-preference-profile";
const ROUTE_SIGNATURE_PRECISION = 10000;
const ROUTE_SIGNATURE_SAMPLE_COUNT = 24;

type DogRow = {
  id: string;
  breed: string;
  weight_kg: number;
  birth_date: string;
  social_preference: DogSocialPreference;
  personality_tags: DogPersonalityTag[] | null;
  health_notes: string | null;
};

type ReviewFactorKey = keyof RecommendedCourseScoreDetails;

type ReviewPreferenceSummary = {
  totalRecords: number;
  signalRecords: number;
  adjustments: Record<ReviewFactorKey, number>;
  weightAdjustments: Record<ReviewFactorKey, number>;
  signature: string;
  insight: string | null;
};

type WalkReviewPreferenceRow = {
  rating: number | null;
  liked_factor: string | null;
  disliked_factor: string | null;
  liked_notes: string | null;
  disliked_notes: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  recommended_course: unknown | null;
};

const REVIEW_FACTOR_KEYS: readonly ReviewFactorKey[] = [
  "riskZones",
  "vehicleExposure",
  "pedestrianSafety",
  "environment",
  "familiarity",
  "fit"
];

const REVIEW_FACTOR_LABELS: Record<ReviewFactorKey, string> = {
  riskZones: "위험구간",
  vehicleExposure: "차량 노출",
  pedestrianSafety: "보행 위험",
  environment: "공원/가로수",
  familiarity: "익숙함/새로움",
  fit: "거리/시간 적합도"
};

const REVIEW_FACTOR_SET = new Set<string>(REVIEW_FACTOR_KEYS);
const REVIEW_PREFERENCE_LOOKBACK_LIMIT = 20;
const REVIEW_PREFERENCE_MAX_SIGNAL_ADJUSTMENT = 0.24;
const REVIEW_PREFERENCE_NORMALIZATION_WEIGHT = 3;
const REVIEW_PREFERENCE_WEIGHT_DELTA_MULTIPLIER = 45;
const AI_PREFERENCE_SIGNAL_ADJUSTMENT_MULTIPLIER = 0.18;
const AI_PREFERENCE_WEIGHT_DELTA_MULTIPLIER = 45;
const REVIEW_PREFERENCE_MAX_WEIGHT_ADJUSTMENT =
  REVIEW_PREFERENCE_MAX_SIGNAL_ADJUSTMENT * REVIEW_PREFERENCE_WEIGHT_DELTA_MULTIPLIER;

function emptyReviewPreferenceSummary(): ReviewPreferenceSummary {
  return {
    totalRecords: 0,
    signalRecords: 0,
    adjustments: {
      riskZones: 0,
      vehicleExposure: 0,
      pedestrianSafety: 0,
      environment: 0,
      familiarity: 0,
      fit: 0
    },
    weightAdjustments: {
      riskZones: 0,
      vehicleExposure: 0,
      pedestrianSafety: 0,
      environment: 0,
      familiarity: 0,
      fit: 0
    },
    signature: "none",
    insight: null
  };
}

function isReviewFactorKey(value: string | null): value is ReviewFactorKey {
  return value !== null && REVIEW_FACTOR_SET.has(value);
}

function clampReviewAdjustment(value: number): number {
  return Math.max(
    -REVIEW_PREFERENCE_MAX_SIGNAL_ADJUSTMENT,
    Math.min(REVIEW_PREFERENCE_MAX_SIGNAL_ADJUSTMENT, value)
  );
}

function roundAdjustment(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundWeightAdjustment(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampReviewWeightAdjustment(value: number): number {
  return Math.max(0, Math.min(REVIEW_PREFERENCE_MAX_WEIGHT_ADJUSTMENT, value));
}

function reviewSignalWeight(rating: number | null, polarity: "liked" | "disliked"): number {
  if (rating === null) {
    return 0.75;
  }

  if (polarity === "liked") {
    return rating >= 4 ? 1 : rating === 3 ? 0.5 : 0.25;
  }

  return rating <= 2 ? 1.25 : rating === 3 ? 1 : 0.75;
}

function summarizeReviewPreferences(rows: readonly WalkReviewPreferenceRow[]): ReviewPreferenceSummary {
  const summary = emptyReviewPreferenceSummary();
  const likedScores = new Map<ReviewFactorKey, number>();
  const dislikedScores = new Map<ReviewFactorKey, number>();

  for (const row of rows) {
    let hasSignal = false;

    if (isReviewFactorKey(row.liked_factor)) {
      likedScores.set(
        row.liked_factor,
        (likedScores.get(row.liked_factor) ?? 0) + reviewSignalWeight(row.rating, "liked")
      );
      hasSignal = true;
    }

    if (isReviewFactorKey(row.disliked_factor)) {
      dislikedScores.set(
        row.disliked_factor,
        (dislikedScores.get(row.disliked_factor) ?? 0) + reviewSignalWeight(row.rating, "disliked")
      );
      hasSignal = true;
    }

    if (hasSignal) {
      summary.signalRecords += 1;
    }
  }

  summary.totalRecords = rows.length;

  const signatureParts: string[] = [];
  let strongestKey: ReviewFactorKey | null = null;
  let strongestWeightAdjustment = 0;

  for (const key of REVIEW_FACTOR_KEYS) {
    const likedScore = likedScores.get(key) ?? 0;
    const dislikedScore = dislikedScores.get(key) ?? 0;
    const rawAdjustment = (likedScore - dislikedScore) / REVIEW_PREFERENCE_NORMALIZATION_WEIGHT;
    const adjustment = roundAdjustment(clampReviewAdjustment(rawAdjustment));
    const weightAdjustment = roundWeightAdjustment(
      Math.abs(
        clampReviewAdjustment((likedScore + dislikedScore) / REVIEW_PREFERENCE_NORMALIZATION_WEIGHT)
      ) * REVIEW_PREFERENCE_WEIGHT_DELTA_MULTIPLIER
    );

    summary.adjustments[key] = adjustment;
    summary.weightAdjustments[key] = weightAdjustment;
    signatureParts.push(`${key}:${adjustment}:${weightAdjustment}`);

    if (weightAdjustment > strongestWeightAdjustment) {
      strongestKey = key;
      strongestWeightAdjustment = weightAdjustment;
    }
  }

  summary.signature = summary.signalRecords > 0 ? signatureParts.join("|") : "none";
  if (strongestKey) {
    const strongestAdjustment = summary.adjustments[strongestKey];
    summary.insight =
      strongestAdjustment > 0
        ? `최근 산책 리뷰에서 ${REVIEW_FACTOR_LABELS[strongestKey]} 만족도가 높아 이 요소의 가중치를 높였어요.`
        : strongestAdjustment < 0
          ? `최근 산책 리뷰에서 ${REVIEW_FACTOR_LABELS[strongestKey]} 아쉬움이 있어 이 요소를 더 엄격하게 봤어요.`
          : `최근 산책 리뷰에서 ${REVIEW_FACTOR_LABELS[strongestKey]} 언급이 많아 이 요소의 가중치를 높였어요.`;
  }

  return summary;
}

function aiSignalPolarityAdjustment(polarity: AiPreferenceSignal["polarity"]): number {
  if (polarity === "liked") {
    return 1;
  }

  if (polarity === "disliked") {
    return -1;
  }

  return 0;
}

function mergeAiPreferenceProfile(
  summary: ReviewPreferenceSummary,
  profile: AiPreferenceProfile
): ReviewPreferenceSummary {
  if (profile.signals.length === 0) {
    return summary;
  }

  for (const signal of profile.signals) {
    const signalPower = Math.max(0, Math.min(1, signal.strength * signal.confidence));
    const direction = aiSignalPolarityAdjustment(signal.polarity);
    const signalAdjustment = signalPower * AI_PREFERENCE_SIGNAL_ADJUSTMENT_MULTIPLIER * direction;
    const weightAdjustment = signalPower * AI_PREFERENCE_WEIGHT_DELTA_MULTIPLIER;

    summary.adjustments[signal.factor] = roundAdjustment(
      clampReviewAdjustment(summary.adjustments[signal.factor] + signalAdjustment)
    );
    summary.weightAdjustments[signal.factor] = roundWeightAdjustment(
      clampReviewWeightAdjustment(summary.weightAdjustments[signal.factor] + weightAdjustment)
    );
  }

  summary.signalRecords += profile.signals.length;
  summary.signature = `${summary.signature}|ai:${profile.signals
    .map(
      (signal) =>
        `${signal.factor}:${signal.polarity}:${roundAdjustment(signal.strength)}:${roundAdjustment(
          signal.confidence
        )}`
    )
    .join(",")}`;
  summary.insight = profile.insight ?? summary.insight;

  return summary;
}

async function loadReviewPreferenceSummary(dogId: string): Promise<ReviewPreferenceSummary> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("walk_records")
    .select(
      "rating, liked_factor, disliked_factor, liked_notes, disliked_notes, distance_meters, duration_seconds, recommended_course"
    )
    .eq("dog_id", dogId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(REVIEW_PREFERENCE_LOOKBACK_LIMIT);

  if (error) {
    if (error.code === "42703") {
      return emptyReviewPreferenceSummary();
    }

    throw new AppError(error.message, 500, "WALK_REVIEW_PREFERENCE_LOOKUP_FAILED");
  }

  const rows = (data ?? []) as WalkReviewPreferenceRow[];
  const summary = summarizeReviewPreferences(rows);
  const aiProfile = await inferAiPreferenceProfile(rows).catch(() => ({
    signals: [],
    insight: null
  }));

  return mergeAiPreferenceProfile(summary, aiProfile);
}

function sumRouteWeights(weights: ScoreBreakdown["weights"]): number {
  return REVIEW_FACTOR_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

function applyReviewWeightAdjustments(
  weights: ScoreBreakdown["weights"],
  preference: ReviewPreferenceSummary
): ScoreBreakdown["weights"] {
  const totalBefore = sumRouteWeights(weights);
  const adjusted: ScoreBreakdown["weights"] = { ...weights };

  for (const key of REVIEW_FACTOR_KEYS) {
    adjusted[key] += preference.weightAdjustments[key];
  }

  const totalAfter = sumRouteWeights(adjusted);

  if (totalAfter <= 0) {
    return weights;
  }

  const normalizationRatio = totalBefore / totalAfter;

  for (const key of REVIEW_FACTOR_KEYS) {
    adjusted[key] = roundWeightAdjustment(adjusted[key] * normalizationRatio);
  }

  return adjusted;
}

function recalculateScoreBreakdown(
  breakdown: ScoreBreakdown,
  weights: ScoreBreakdown["weights"]
): ScoreBreakdown {
  const { components } = breakdown;
  const safetyWeightTotal =
    weights.riskZones + weights.vehicleExposure + weights.pedestrianSafety;
  const comfortWeightTotal = weights.environment + weights.familiarity;

  const safety =
    safetyWeightTotal > 0
      ? (components.riskZones * weights.riskZones +
          components.vehicleExposure * weights.vehicleExposure +
          components.pedestrianSafety * weights.pedestrianSafety) /
        safetyWeightTotal
      : breakdown.safety;
  const comfort =
    comfortWeightTotal > 0
      ? (components.environment * weights.environment +
          components.familiarity * weights.familiarity) /
        comfortWeightTotal
      : breakdown.comfort;
  const totalScore =
    components.riskZones * weights.riskZones +
    components.vehicleExposure * weights.vehicleExposure +
    components.pedestrianSafety * weights.pedestrianSafety +
    components.environment * weights.environment +
    components.familiarity * weights.familiarity +
    components.fit * weights.fit;

  return {
    ...breakdown,
    safety,
    comfort,
    totalScore,
    weights
  };
}

function applyReviewPreferenceAdjustments(
  courses: readonly ScoredCourse[],
  preference: ReviewPreferenceSummary
): ScoredCourse[] {
  if (preference.signalRecords === 0) {
    return [...courses];
  }

  return courses
    .map((course) => {
      const weights = applyReviewWeightAdjustments(course.breakdown.weights, preference);

      return {
        ...course,
        breakdown: recalculateScoreBreakdown(course.breakdown, weights)
      };
    })
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
}

/**
 * Change 1 (2026-08-14 user request): courses were sometimes far off the
 * requested duration (e.g. target 25min, ~10min shown). The user explicitly
 * chose NOT to tighten DISTANCE_FILTER_TOLERANCE_RATIO back toward the
 * spec's ±20% — that constant was deliberately widened to ±50% on
 * 2026-08-10 after confirming a tighter filter causes frequent
 * no_courses_found failures against real GraphHopper round_trip output (see
 * the comment above DISTANCE_FILTER_TOLERANCE_RATIO in walk-tuning.ts).
 * Instead this is a soft re-ranking preference applied after scoring: never
 * excludes a candidate, only nudges duration-accurate ones higher. Kept
 * small relative to ROUTE_SCORE_WEIGHTS.riskZones (35) so it can break ties
 * and mild gaps without letting a duration match outweigh a real safety
 * difference between candidates.
 */
const DURATION_CLOSENESS_TOLERANCE_MINUTES = 3;
const DURATION_CLOSENESS_BONUS = 4;
const DURATION_CLOSENESS_PENALTY_PER_EXTRA_MINUTE = 0.4;
const DURATION_CLOSENESS_MAX_PENALTY = 4;

function durationClosenessAdjustment(durationMinutes: number, targetMinutes: number): number {
  const diffMinutes = Math.abs(durationMinutes - targetMinutes);

  if (diffMinutes <= DURATION_CLOSENESS_TOLERANCE_MINUTES) {
    return DURATION_CLOSENESS_BONUS;
  }

  const excessMinutes = diffMinutes - DURATION_CLOSENESS_TOLERANCE_MINUTES;
  return -Math.min(
    excessMinutes * DURATION_CLOSENESS_PENALTY_PER_EXTRA_MINUTE,
    DURATION_CLOSENESS_MAX_PENALTY
  );
}

/**
 * Re-sorts already-scored, already-hard-filtered candidates so ones close
 * to the target duration rank higher, without ever dropping a candidate.
 * Must run AFTER applyReviewPreferenceAdjustments, not before — that
 * function recomputes totalScore from scratch off `components * weights`,
 * which would silently discard any earlier duration bonus/penalty baked
 * into totalScore.
 */
function applyDurationClosenessPreference(
  courses: readonly ScoredCourse[],
  targetMinutes: number
): ScoredCourse[] {
  return courses
    .map((course) => {
      const durationMinutes = Math.round(course.facts.timeMs / 60000);
      const adjustment = durationClosenessAdjustment(durationMinutes, targetMinutes);

      return {
        ...course,
        breakdown: {
          ...course.breakdown,
          totalScore: course.breakdown.totalScore + adjustment
        }
      };
    })
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
}

function preferenceDetailSuffix(
  key: ReviewFactorKey,
  preference: ReviewPreferenceSummary
): string {
  const adjustment = preference.adjustments[key];
  const weightAdjustment = preference.weightAdjustments[key];

  if (weightAdjustment === 0) {
    return "";
  }

  if (adjustment > 0) {
    return " 최근 리뷰에서 좋았던 점으로 선택되어 이번 추천에서 더 중요하게 봤어요.";
  }

  if (adjustment < 0) {
    return " 최근 리뷰에서 아쉬웠던 점으로 선택되어 이번 추천에서 더 엄격하게 봤어요.";
  }

  return " 최근 리뷰에서 자주 언급되어 이번 추천에서 더 중요하게 봤어요.";
}

/** Exported for the lightweight GET /duration-options and GET /warnings
 * controllers, which need a DogProfile but should not run the rest of the
 * pipeline (spec 7.3 최적화 1). */
export async function loadDogProfile(dogId: string, now: Date): Promise<DogProfile> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("dogs")
    .select("id, breed, weight_kg, birth_date, social_preference, personality_tags, health_notes")
    .eq("id", dogId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "DOG_LOOKUP_FAILED");
  }

  if (!data) {
    throw new AppError("Dog not found.", 404, "DOG_NOT_FOUND");
  }

  const dog = data as DogRow;
  const breedInfo = await findDogBreedById(dog.breed);

  return normalizeDogProfile(
    {
      dogId: dog.id,
      breedId: dog.breed,
      akcGroupName: breedInfo?.groupName ?? null,
      weightKg: dog.weight_kg,
      birthDateIso: dog.birth_date,
      socialPreference: dog.social_preference,
      personalityTags: dog.personality_tags ?? [],
      healthNotes: dog.health_notes
    },
    now
  );
}

/**
 * ① + ②: fetches weather/air-quality in parallel, evaluates warnings, and
 * derives this dog's target duration. Exposed separately (not just inline
 * in recommendWalkRoutes) so GET /duration-options and GET /warnings can
 * reuse it without running the rest of the pipeline (spec 7.3 최적화 1:
 * "앱 진입 즉시 GPS 및 날씨를 백그라운드로 선요청").
 */
export async function evaluateWarningsAndDuration(
  profile: DogProfile,
  origin: LatLon,
  now: Date
): Promise<{ warningEvaluation: WarningEvaluation; durationOptions: DurationOptions }> {
  // 에어코리아(data.go.kr)는 간헐적으로 504 SERVICETIMEOUT_ERROR를 낸다.
  // 미세먼지를 못 읽었다고 산책 추천 자체를 막을 이유는 없으므로 실패를
  // 삼킨다. 이때 pm10/pm25는 weather.provider.ts가 넣어둔 NaN으로 남고,
  // warning-check의 `>=` 비교는 NaN에 대해 항상 false라 미세먼지 경고만
  // 조용히 빠진다.
  const [weatherSnapshot, airQualitySnapshot] = await Promise.all([
    getWeatherSnapshot(origin.lat, origin.lon),
    getAirQualitySnapshot(origin.lat, origin.lon).catch(() => null)
  ]);

  const mergedWeather: WeatherSnapshot = airQualitySnapshot
    ? {
        ...weatherSnapshot,
        pm10: airQualitySnapshot.pm10,
        pm25: airQualitySnapshot.pm25
      }
    : weatherSnapshot;

  const warningEvaluation = evaluateWarnings(profile, mergedWeather, now);
  const durationOptions = calculateTargetDuration(profile, warningEvaluation.durationPenaltyRatio);

  return { warningEvaluation, durationOptions };
}

function resolveTargetMinutes(durationOptions: DurationOptions, request: RecommendationRequest): number {
  if (request.durationChoice === "minimum") {
    return durationOptions.minimumMinutes;
  }

  if (request.durationChoice === "recommended") {
    return durationOptions.recommendedMinutes;
  }

  if (request.customMinutes === undefined) {
    throw new AppError(
      "customMinutes is required when durationChoice is 'custom'.",
      400,
      "CUSTOM_MINUTES_REQUIRED"
    );
  }

  if (
    request.customMinutes < durationOptions.minimumMinutes ||
    request.customMinutes > durationOptions.maximumMinutes
  ) {
    throw new AppError(
      `customMinutes must be between ${durationOptions.minimumMinutes} and ${durationOptions.maximumMinutes}.`,
      400,
      "CUSTOM_MINUTES_OUT_OF_RANGE"
    );
  }

  return request.customMinutes;
}

/**
 * Built from the request alone — no DB/API calls — so the cache can be
 * checked before loading the dog profile or weather, not after. Using the
 * *chosen* duration (durationChoice + customMinutes) rather than the fully
 * resolved target-minutes value is what makes that possible: resolving
 * actual minutes requires the profile and the current warning penalty
 * ratio, which would defeat the purpose of checking the cache first. Two
 * requests with the same choice map to the same resolved minutes anyway as
 * long as weather hasn't changed enough to flip the warning level within
 * the cache TTL, which is the same granularity spec 7.3's "시간대" bucket
 * already assumes.
 */
function buildCacheKey(
  origin: LatLon,
  dogId: string,
  durationChoice: DurationChoice,
  customMinutes: number | undefined,
  now: Date,
  reviewPreferenceSignature = "none"
): string {
  const gridKey = gridKeyForPoint(origin, BEARING_GRID_CELL_SIZE_M);
  const timeOfDay = resolveTimeOfDayBucket(
    getKstHour(now),
    MORNING_END_HOUR,
    EVENING_OR_NIGHT_START_HOUR,
    EVENING_OR_NIGHT_END_HOUR
  );
  const durationKey = durationChoice === "custom" ? `custom:${customMinutes}` : durationChoice;

  return `${RECOMMENDATION_CACHE_VERSION}:${gridKey}:${dogId}:${durationKey}:${timeOfDay}:review:${reviewPreferenceSignature}`;
}

type WalkCourseCacheRow = {
  cache_key: string;
  payload: RecommendationResult;
  expires_at: string;
};

async function readPersistentCache(cacheKey: string): Promise<RecommendationResult | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("walk_course_cache")
    .select("cache_key, payload, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error) {
    // A persistent-cache read failure should never fail the whole request —
    // fall through to recomputing, matching this table's "선택" (optional)
    // status in spec 6.
    return null;
  }

  const row = data as WalkCourseCacheRow | null;

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return row.payload;
}

async function writePersistentCache(
  cacheKey: string,
  result: RecommendationResult,
  now: Date
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const expiresAt = new Date(now.getTime() + RECOMMENDATION_CACHE_TTL_SECONDS * 1000).toISOString();

  // Best-effort: a write failure here must not fail the request that
  // already has a perfectly good result to return.
  await supabase
    .from("walk_course_cache")
    .upsert({ cache_key: cacheKey, payload: result, expires_at: expiresAt })
    .then(
      () => undefined,
      () => undefined
    );
}

/**
 * Round-12 "비동기 검증": called WITHOUT `await` right before
 * `recommendWalkRoutes` returns its "ok" result, so it runs after the HTTP
 * response has already gone out (spec 7.3: TMAP은 파이프라인에 포함하지
 * 않음— this function is the "않음" part made concrete). Verifies each of
 * the final courses against TMAP in parallel, and — only for the courses
 * that succeed — writes an updated result back to both cache layers under
 * the same key, so a client that re-requests the same recommendation
 * shortly after gets the enriched crosswalk/steps counts from cache
 * without the original request ever having waited on TMAP.
 *
 * Every failure mode here is swallowed (logged, not thrown/rejected) —
 * this function's caller does not and must not await it, so an unhandled
 * rejection here would become an unhandled rejection at the process
 * level, not something any request's error handling could catch.
 */
function enrichCoursesWithTmapInBackground(
  cacheKey: string,
  result: Extract<RecommendationResult, { status: "ok" }>,
  now: Date
): void {
  void (async () => {
    const verifiedAt = new Date().toISOString();

    const enrichedCourses = await Promise.all(
      result.courses.map(async (course) => {
        try {
          const points = course.path.coordinates.map(([lon, lat]) => ({ lat, lon }));
          const facilityCounts = await verifyPedestrianRoute(points);

          return {
            ...course,
            facts: {
              ...course.facts,
              crosswalkCount: facilityCounts.crosswalkCount,
              stepsCount: facilityCounts.stepsCount,
              tmapVerifiedAt: verifiedAt
            }
          };
        } catch (error) {
          console.error(
            `[recommendation.service] TMAP verification failed for course rank ${course.rank}:`,
            error instanceof Error ? error.message : error
          );
          return course; // leave this one course's facts as they were
        }
      })
    );

    const enrichedResult: RecommendationResult = { ...result, courses: enrichedCourses };

    recommendationCache.set(cacheKey, enrichedResult);
    await writePersistentCache(cacheKey, enrichedResult, now).catch((error) => {
      console.error("[recommendation.service] Failed to persist TMAP-enriched result:", error);
    });
  })().catch((error) => {
    console.error("[recommendation.service] TMAP background enrichment pass failed:", error);
  });
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function routePointSignature(point: LatLon): string {
  return `${Math.round(point.lat * ROUTE_SIGNATURE_PRECISION)},${Math.round(
    point.lon * ROUTE_SIGNATURE_PRECISION
  )}`;
}

function buildRouteSignature(points: readonly LatLon[]): string {
  if (points.length === 0) {
    return "";
  }

  const stride = Math.max(1, Math.floor(points.length / ROUTE_SIGNATURE_SAMPLE_COUNT));
  const sampled: string[] = [];

  for (let index = 0; index < points.length; index += stride) {
    sampled.push(routePointSignature(points[index]));
  }

  const lastSignature = routePointSignature(points[points.length - 1]);

  if (sampled[sampled.length - 1] !== lastSignature) {
    sampled.push(lastSignature);
  }

  const forward = sampled.join("|");
  const reverse = [...sampled].reverse().join("|");

  return forward < reverse ? forward : reverse;
}

function buildCourseExplanation(
  facts: CourseFacts,
  breakdown: ScoreBreakdown,
  profile: DogProfile,
  targetMeters: number,
  reviewPreference: ReviewPreferenceSummary
): RecommendedCourseExplanation {
  const factors: RecommendedCourseExplanation["factors"] = [
    {
      key: "riskZones",
      label: "사고다발/위험구간",
      score: roundScore(breakdown.components.riskZones),
      weight: breakdown.weights.riskZones,
      contribution: roundScore(breakdown.components.riskZones * breakdown.weights.riskZones),
      detail:
        facts.riskZoneCount === 0
          ? "사고다발/위험구간을 지나지 않아 가장 크게 가점됐어요."
          : `사고다발/위험구간 ${facts.riskZoneCount}곳을 지나 감점됐어요.`
    },
    {
      key: "vehicleExposure",
      label: "차량 노출도",
      score: roundScore(breakdown.components.vehicleExposure),
      weight: breakdown.weights.vehicleExposure,
      contribution: roundScore(
        breakdown.components.vehicleExposure * breakdown.weights.vehicleExposure
      ),
      detail:
        facts.vehicleExposureAvg === null
          ? "도로 매칭 데이터가 없어 보수적으로 가장 위험한 차량 노출도로 계산했어요."
          : `차량 노출도 평균 ${roundScore(facts.vehicleExposureAvg)}/5 기준으로 계산했어요.`
    },
    {
      key: "pedestrianSafety",
      label: "보행 위험",
      score: roundScore(breakdown.components.pedestrianSafety),
      weight: breakdown.weights.pedestrianSafety,
      contribution: roundScore(
        breakdown.components.pedestrianSafety * breakdown.weights.pedestrianSafety
      ),
      detail: profile.needsStairFilter
        ? `계단 ${facts.stepsCount}개 기준으로 계산했어요. 이 강아지는 계단 회피 대상이에요.`
        : "현재 동기 계산에서는 일반 강아지의 계단 개수를 감점하지 않아요."
    },
    {
      key: "environment",
      label: "가로수/공원/벤치",
      score: roundScore(breakdown.components.environment),
      weight: breakdown.weights.environment,
      contribution: roundScore(breakdown.components.environment * breakdown.weights.environment),
      detail:
        profile.lifeStage === "senior" || profile.lifeStage === "geriatric"
          ? `가로수 ${roundScore(facts.treesPerKm)}/km, 공원 ${formatPercent(
              facts.parkRatio
            )}, 벤치 ${facts.benchCount}개를 반영했어요.`
          : `가로수 ${roundScore(facts.treesPerKm)}/km, 공원 ${formatPercent(
              facts.parkRatio
            )}를 반영했어요. 벤치는 노령견 점수에서만 직접 반영돼요.`
    },
    {
      key: "familiarity",
      label: "익숙함/새로움",
      score: roundScore(breakdown.components.familiarity),
      weight: breakdown.weights.familiarity,
      contribution: roundScore(breakdown.components.familiarity * breakdown.weights.familiarity),
      detail: profile.personality.isAdventurous
        ? `탐험 성향이라 최근 경로와 덜 겹칠수록 좋아요. 현재 겹침은 ${formatPercent(
            facts.diversityOverlapRatio
          )}예요.`
        : `익숙한 길을 선호하는 기준이라 최근 경로와 더 겹칠수록 좋아요. 현재 겹침은 ${formatPercent(
            facts.diversityOverlapRatio
          )}예요.`
    },
    {
      key: "fit",
      label: "요청 시간/거리 적합도",
      score: roundScore(breakdown.components.fit),
      weight: breakdown.weights.fit,
      contribution: roundScore(breakdown.components.fit * breakdown.weights.fit),
      detail: `목표 거리 ${Math.round(targetMeters)}m 대비 실제 거리 ${Math.round(
        facts.distanceMeters
      )}m 기준으로 계산했어요.`
    }
  ];

  const adjustedFactors = factors.map((factor) => {
    const preferenceAdjustment = reviewPreference.adjustments[factor.key];

    return {
      ...factor,
      detail: `${factor.detail}${preferenceDetailSuffix(factor.key, reviewPreference)}`,
      preferenceAdjustment: preferenceAdjustment === 0 ? undefined : preferenceAdjustment
    };
  });

  return {
    summary: "총점은 사고위험, 차량노출, 보행위험, 환경/성격, 거리 적합도를 가중 합산해 계산해요.",
    factors: adjustedFactors
  };
}

/** Vehicle-exposure values are on a 0..VEHICLE_EXPOSURE_MAX scale (5.6절);
 * anything at or above the midpoint reads as "다소 높음" for a caution
 * bullet — not tied to the scoring normalization, just a plain-language
 * threshold for this specific display. */
const VEHICLE_EXPOSURE_CAUTION_THRESHOLD = VEHICLE_EXPOSURE_MAX / 2;

/** Dog-encounter-probability threshold (0..1 composite, see
 * calculateDogEncounterProbability in scoring-weighted.ts) above/below
 * which it's worth calling out for a dog whose personality cares about it. */
const DOG_ENCOUNTER_CAUTION_HIGH_THRESHOLD = 0.5;
const DOG_ENCOUNTER_CAUTION_LOW_THRESHOLD = 0.2;

/**
 * Change 2/8 (2026-08-14 user request): replaces the score/weight/
 * contribution breakdown shown to users with concrete, risk-focused
 * cautions built from the same underlying facts — "위험구간 2곳을
 * 지나요" instead of an abstract "riskZones: 0.7". Deliberately only
 * surfaces things worth being cautious about; positive traits belong in
 * the AI/fallback course name and prose explanation, not here.
 */
function buildCourseCautions(
  facts: CourseFacts,
  breakdown: ScoreBreakdown,
  profile: DogProfile
): string[] {
  const cautions: string[] = [];

  if (facts.riskZoneCount > 0) {
    cautions.push(`사고다발/위험구간 ${facts.riskZoneCount}곳을 지나요.`);
  }

  if (facts.vehicleExposureAvg === null) {
    cautions.push("도로 매칭 데이터가 부족해 차량 노출도를 보수적으로 계산했어요.");
  } else if (facts.vehicleExposureAvg >= VEHICLE_EXPOSURE_CAUTION_THRESHOLD) {
    cautions.push("차량 노출도가 다소 높은 구간이 있어요.");
  }

  if (profile.needsStairFilter && facts.stepsCount > 0) {
    cautions.push(`계단 ${facts.stepsCount}개가 있어요 (계단 회피 대상견 기준).`);
  }

  if (
    profile.personality.avoidsDogs &&
    breakdown.dogEncounterProbability >= DOG_ENCOUNTER_CAUTION_HIGH_THRESHOLD
  ) {
    cautions.push("다른 강아지를 마주칠 가능성이 있는 구간이에요.");
  }

  if (
    profile.personality.prefersDogEncounters &&
    breakdown.dogEncounterProbability < DOG_ENCOUNTER_CAUTION_LOW_THRESHOLD
  ) {
    cautions.push("이 코스는 다른 강아지를 만날 기회가 적을 수 있어요.");
  }

  return cautions;
}

function toRecommendedCourse(
  rank: number,
  facts: CourseFacts,
  breakdown: ScoreBreakdown,
  profile: DogProfile,
  targetMeters: number,
  reviewPreference: ReviewPreferenceSummary
): RecommendedCourse {
  return {
    rank,
    direction: facts.bearing.labelKo,
    distanceMeters: Math.round(facts.distanceMeters),
    durationMinutes: Math.round(facts.timeMs / 60000),
    score: roundScore(breakdown.totalScore),
    breakdown: { safety: breakdown.safety, comfort: breakdown.comfort, fit: breakdown.fit },
    scoreDetails: {
      riskZones: roundScore(breakdown.components.riskZones),
      vehicleExposure: roundScore(breakdown.components.vehicleExposure),
      pedestrianSafety: roundScore(breakdown.components.pedestrianSafety),
      environment: roundScore(breakdown.components.environment),
      familiarity: roundScore(breakdown.components.familiarity),
      fit: roundScore(breakdown.components.fit)
    },
    explanation: buildCourseExplanation(facts, breakdown, profile, targetMeters, reviewPreference),
    cautions: buildCourseCautions(facts, breakdown, profile),
    preferenceInsight: reviewPreference.insight,
    facts: {
      vehicleExposure: facts.vehicleExposureAvg,
      parkRatio: facts.parkRatio,
      treesPerKm: facts.treesPerKm,
      riskZoneCount: facts.riskZoneCount,
      benchCount: facts.benchCount,
      dogEncounterProbability: breakdown.dogEncounterProbability,
      crosswalkCount: null,
      stepsCount: facts.stepsCount,
      tmapVerifiedAt: null
    },
    path: {
      type: "LineString",
      coordinates: facts.points.map((point) => [point.lon, point.lat])
    }
  };
}

/**
 * The full pipeline. Returns a discriminated-union result rather than
 * throwing for the "not really an error, just nothing to recommend"
 * outcomes (insufficient coverage, every candidate failed generation, or
 * every generated candidate was filtered out) — those are expected,
 * user-facing states, not exceptional ones.
 */
export async function recommendWalkRoutes(
  request: RecommendationRequest,
  now: Date = new Date()
): Promise<RecommendationResult> {
  const profile = await loadDogProfile(request.dogId, now);
  const reviewPreference = await loadReviewPreferenceSummary(request.dogId);
  // 모험적인 성격은 매번 새 코스를 뽑는 게 의도라 애초에 캐시를 쓰지 않는다.
  const shouldUseRecommendationCache = !profile.personality.isAdventurous;
  // "다시 추천받기"(refresh)는 읽기만 건너뛴다. 쓰기는 그대로 해서 이어지는
  // 일반 요청이 새로 뽑은 코스를 받게 한다.
  const shouldReadCache = shouldUseRecommendationCache && !request.refresh;

  // Built from the request alone, so both cache layers can be checked
  // before any DB/API call — see buildCacheKey's doc comment for why this
  // has to use the request's chosen duration rather than fully-resolved
  // target minutes.
  const cacheKey = buildCacheKey(
    request.origin,
    request.dogId,
    request.durationChoice,
    request.customMinutes,
    now,
    reviewPreference.signature
  );

  if (shouldReadCache) {
    const cachedInMemory = recommendationCache.get(cacheKey);
    if (cachedInMemory) {
      return cachedInMemory;
    }

    const cachedPersisted = await readPersistentCache(cacheKey);
    if (cachedPersisted) {
      recommendationCache.set(cacheKey, cachedPersisted);
      return cachedPersisted;
    }
  }

  const { warningEvaluation, durationOptions } = await evaluateWarningsAndDuration(
    profile,
    request.origin,
    now
  );

  const targetMinutes = resolveTargetMinutes(durationOptions, request);
  const targetMeters = Math.round(targetMinutes * (profile.walkingSpeedKmh / 60) * 1000);

  const roadCounts = await getRoadCountsByBearing(request.origin);

  if (!isCoverageSufficient(roadCounts)) {
    const result: RecommendationResult = {
      status: "insufficient_coverage",
      message: "이 지역은 산책로 데이터가 부족해서 코스를 만들 수 없어요."
    };
    // Coverage results are still cached — recomputing the same "no data
    // here" answer on every request in a genuinely uncovered area wastes
    // the weather/air-quality calls that already ran above for nothing.
    if (shouldUseRecommendationCache) {
      recommendationCache.set(cacheKey, result);
      await writePersistentCache(cacheKey, result, now);
    }
    return result;
  }

  const bearings = selectTopBearings(roadCounts);

  const [{ candidates, failures }, originContext] = await Promise.all([
    generateRouteCandidates(request.origin, targetMeters, bearings, profile, now, {
      // 캐시를 건너뛰어도 시드가 같으면 GraphHopper 가 같은 코스를 준다.
      randomizeSeeds: Boolean(request.refresh)
    }),
    fetchOriginContext(request.origin)
  ]);

  if (candidates.length === 0) {
    return {
      status: "generation_failed",
      message: "코스를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.",
      failures
    };
  }

  const facts = await scoreRouteCandidates(candidates, request.dogId);
  let hardFiltered = applyHardFilters(facts, targetMeters, profile);
  let distanceApproximate = false;

  if (hardFiltered.length === 0) {
    // Every candidate missed the distance tolerance — GraphHopper's
    // round_trip doesn't hit target distances precisely (confirmed
    // 2026-08-10), so this is common, not exceptional. Retry with the
    // distance gate off (stairs safety gate stays on) rather than telling
    // the user nothing was found when real candidates exist.
    hardFiltered = applyHardFilters(facts, targetMeters, profile, false);
    distanceApproximate = hardFiltered.length > 0;
  }

  if (hardFiltered.length === 0) {
    const result: RecommendationResult = {
      status: "no_courses_found",
      message: "조건에 맞는 코스를 찾지 못했어요. 목표 거리를 조정해 보세요."
    };
    return result;
  }

  const orderedWithBreakdown = rankByWeightedScore(
    hardFiltered,
    targetMeters,
    profile,
    originContext
  );

  const adjustedWithReviewPreferences = applyReviewPreferenceAdjustments(
    orderedWithBreakdown,
    reviewPreference
  );

  const durationAdjusted = applyDurationClosenessPreference(
    adjustedWithReviewPreferences,
    targetMinutes
  );

  const finalSelection = selectFinalCourses(
    durationAdjusted,
    (item) => item.facts.bearing.bin,
    (item) => buildRouteSignature(item.facts.points)
  );

  const durationApproximate = finalSelection.every(
    (item) =>
      Math.abs(Math.round(item.facts.timeMs / 60000) - targetMinutes) >
      DURATION_CLOSENESS_TOLERANCE_MINUTES
  );

  const result: RecommendationResult = {
    status: "ok",
    courses: finalSelection.map((item, index) =>
      toRecommendedCourse(index + 1, item.facts, item.breakdown, profile, targetMeters, reviewPreference)
    ),
    warnings: warningEvaluation.warnings,
    durationOptions,
    ...(distanceApproximate ? { distanceApproximate: true } : {}),
    ...(durationApproximate ? { durationApproximate: true } : {})
  };

  if (shouldUseRecommendationCache) {
    recommendationCache.set(cacheKey, result);
    await writePersistentCache(cacheKey, result, now);
  }

  // Fire-and-forget: deliberately not awaited, so this request returns
  // immediately with `result` and TMAP verification happens after the
  // response has already gone out (spec 7.3).
  if (shouldUseRecommendationCache) {
    enrichCoursesWithTmapInBackground(cacheKey, result, now);
  }

  return result;
}
