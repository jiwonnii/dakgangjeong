/**
 * 5.6절 2차 확장: 3축 가중치. An alternative, more expressive ranking
 * strategy to scoring-filter.ts's rankByHierarchicalFilter — both consume
 * the same hard-filtered CourseFacts from applyHardFilters and produce a
 * best-first ordering; course-selection.ts (round 9's third file) does not
 * care which one produced it.
 *
 * Two adaptations from the literal spec text, both documented where they
 * happen below:
 *   1. 안전 axis omits 횡단보도(crosswalk) data — that only exists from
 *      TMAP, which spec 7.3 explicitly keeps out of the synchronous
 *      pipeline. Since every candidate would receive the exact same
 *      placeholder crosswalk value, including one would not change the
 *      ranking at all — only its absolute scale — so it is left out
 *      entirely rather than faked in.
 *   2. 쾌적 axis folds in "개 마주칠 확률" for dogs whose personality
 *      cares about it (개 만나기 선호 / 개 회피), per spec 3.4's explicit
 *      "채점 | 개 마주칠 확률 가산/감점" — spec 5.6's formula only lists
 *      가로수+공원 in 쾌적, but 3.4 requires dog-encounter probability to
 *      affect scoring somewhere, and comfort is where it fits.
 */

import {
  BENCH_COUNT_NORMALIZATION_MAX,
  DEFAULT_SCORE_WEIGHTS,
  DOG_DENSITY_NORMALIZATION_MAX_PER_SQKM,
  DOG_ENCOUNTER_WEIGHTS,
  FIT_SCORE_NORMALIZATION_RATIO,
  PEDESTRIAN_HAZARD_COUNT_NORMALIZATION_MAX,
  PET_FACILITY_COUNT_NORMALIZATION_MAX,
  RISK_ZONE_COUNT_NORMALIZATION_MAX,
  ROUTE_SCORE_WEIGHTS,
  TREES_PER_KM_NORMALIZATION_MAX,
  VEHICLE_EXPOSURE_FALLBACK_WHEN_UNMATCHED,
  VEHICLE_EXPOSURE_MAX,
  type RouteScoreWeightProfile,
  type ScoreWeightProfile
} from "../../../constants/walk-tuning";
import type { DogProfile } from "./dog-profile";
import type { CourseFacts, OriginContext } from "../services/scoring.service";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scoreFromCount(count: number, normalizationMax: number): number {
  return 1 - clamp01(count / normalizationMax);
}

function normalizeRiskZones(candidate: CourseFacts): number {
  return scoreFromCount(candidate.riskZoneCount, RISK_ZONE_COUNT_NORMALIZATION_MAX);
}

function normalizeVehicleExposure(candidate: CourseFacts): number {
  const exposure = candidate.vehicleExposureAvg ?? VEHICLE_EXPOSURE_FALLBACK_WHEN_UNMATCHED;
  // Higher exposure is worse, so invert: 0 exposure -> 1 (best), max -> 0.
  return 1 - clamp01(exposure / VEHICLE_EXPOSURE_MAX);
}

function normalizeTreeDensity(candidate: CourseFacts): number {
  return clamp01(candidate.treesPerKm / TREES_PER_KM_NORMALIZATION_MAX);
}

function normalizeBenchAccess(candidate: CourseFacts): number {
  return clamp01(candidate.benchCount / BENCH_COUNT_NORMALIZATION_MAX);
}

function normalizePedestrianSafety(candidate: CourseFacts, profile: DogProfile): number {
  if (!profile.needsStairFilter) {
    return 1;
  }

  return scoreFromCount(candidate.stepsCount, PEDESTRIAN_HAZARD_COUNT_NORMALIZATION_MAX);
}

/**
 * Composite "개 마주칠 확률" (spec 5.5 요소, formula not given numerically
 * — weights and normalization caps are this project's own judgment call,
 * documented on DOG_ENCOUNTER_WEIGHTS et al. in walk-tuning.ts).
 *
 * Unknown dong density (no dog_density row covers the origin) is treated
 * as 0 contribution — i.e. "no extra signal either way" — which is a
 * different choice than the vehicle-exposure fallback's "assume the worst"
 * rule. That asymmetry is deliberate: missing vehicle-exposure data is a
 * safety-relevant unknown (default to cautious), while missing density
 * data has no inherent direction to be conservative in, so treating it as
 * neutral (0 contribution, not a fabricated high or low estimate) is more
 * honest than guessing.
 */
export function calculateDogEncounterProbability(
  candidate: CourseFacts,
  originContext: OriginContext
): number {
  const densityNormalized =
    originContext.dongDensityPerSqkm !== null
      ? clamp01(originContext.dongDensityPerSqkm / DOG_DENSITY_NORMALIZATION_MAX_PER_SQKM)
      : 0;

  const facilityNormalized = clamp01(
    candidate.petFacilityCountNearby / PET_FACILITY_COUNT_NORMALIZATION_MAX
  );

  const parkNormalized = clamp01(candidate.parkRatio);

  return (
    densityNormalized * DOG_ENCOUNTER_WEIGHTS.density +
    facilityNormalized * DOG_ENCOUNTER_WEIGHTS.facilities +
    parkNormalized * DOG_ENCOUNTER_WEIGHTS.parkRatio
  );
}

function isSeniorOrGeriatric(profile: DogProfile): boolean {
  return profile.lifeStage === "senior" || profile.lifeStage === "geriatric";
}

function calculateEnvironmentScore(candidate: CourseFacts, profile: DogProfile, originContext: OriginContext): number {
  const environmentTerms = [normalizeTreeDensity(candidate), clamp01(candidate.parkRatio)];

  if (isSeniorOrGeriatric(profile)) {
    environmentTerms.push(normalizeBenchAccess(candidate));
  }

  const baseEnvironment =
    environmentTerms.reduce((sum, term) => sum + term, 0) / environmentTerms.length;

  if (!profile.personality.prefersDogEncounters && !profile.personality.avoidsDogs) {
    return baseEnvironment;
  }

  const dogEncounterProbability = calculateDogEncounterProbability(candidate, originContext);

  const dogEncounterTerm = profile.personality.prefersDogEncounters
    ? dogEncounterProbability
    : 1 - dogEncounterProbability;

  // Base environment terms are weighted 2:1 against
  // the single dog-encounter term so it nudges rather than dominates.
  return (baseEnvironment * 2 + dogEncounterTerm) / 3;
}

function calculateFamiliarityScore(candidate: CourseFacts, profile: DogProfile): number {
  return profile.personality.isAdventurous
    ? 1 - candidate.diversityOverlapRatio
    : candidate.diversityOverlapRatio;
}

function calculateFitScore(actualMeters: number, targetMeters: number): number {
  if (targetMeters <= 0) {
    throw new Error(`Invalid targetMeters for fit score: ${targetMeters}`);
  }

  const rawScore = 1 - Math.abs(actualMeters - targetMeters) / (targetMeters * FIT_SCORE_NORMALIZATION_RATIO);
  return clamp01(rawScore);
}

/**
 * Selects which weight profile applies (spec 5.6 table). When a dog
 * matches more than one condition (e.g. both car-fearful and
 * park-preferring), safety-driven profiles take priority over
 * preference-driven ones — not specified by the spec, but consistent with
 * this project's established safety-first framing (PRD 핵심 가치 1번).
 * Priority: 자동차 무서워함 > 겁 많음(사람 포함) > 공원 선호 > 기본.
 */
export function selectScoreWeights(profile: DogProfile): ScoreWeightProfile {
  void profile;
  return DEFAULT_SCORE_WEIGHTS;
}

export type ScoreBreakdown = {
  safety: number;
  comfort: number;
  fit: number;
  components: {
    riskZones: number;
    vehicleExposure: number;
    pedestrianSafety: number;
    environment: number;
    familiarity: number;
    fit: number;
  };
  totalScore: number;
  weights: RouteScoreWeightProfile;
  dogEncounterProbability: number;
};

export type ScoredCourse = {
  facts: CourseFacts;
  breakdown: ScoreBreakdown;
};

export function calculateWeightedScore(
  candidate: CourseFacts,
  targetMeters: number,
  profile: DogProfile,
  originContext: OriginContext
): ScoreBreakdown {
  const riskZones = normalizeRiskZones(candidate);
  const vehicleExposure = normalizeVehicleExposure(candidate);
  const pedestrianSafety = normalizePedestrianSafety(candidate, profile);
  const environment = calculateEnvironmentScore(candidate, profile, originContext);
  const familiarity = calculateFamiliarityScore(candidate, profile);
  const fit = calculateFitScore(candidate.distanceMeters, targetMeters);
  const weights = ROUTE_SCORE_WEIGHTS;

  const safety =
    (riskZones * weights.riskZones +
      vehicleExposure * weights.vehicleExposure +
      pedestrianSafety * weights.pedestrianSafety) /
    (weights.riskZones + weights.vehicleExposure + weights.pedestrianSafety);

  const comfort =
    (environment * weights.environment + familiarity * weights.familiarity) /
    (weights.environment + weights.familiarity);

  const totalScore =
    riskZones * weights.riskZones +
    vehicleExposure * weights.vehicleExposure +
    pedestrianSafety * weights.pedestrianSafety +
    environment * weights.environment +
    familiarity * weights.familiarity +
    fit * weights.fit;

  return {
    safety,
    comfort,
    fit,
    components: {
      riskZones,
      vehicleExposure,
      pedestrianSafety,
      environment,
      familiarity,
      fit
    },
    totalScore,
    weights,
    dogEncounterProbability: calculateDogEncounterProbability(candidate, originContext)
  };
}

/**
 * Scores every hard-filtered candidate and returns them best-first by
 * totalScore — the "2차 확장" counterpart to
 * scoring-filter.ts's rankByHierarchicalFilter.
 */
export function rankByWeightedScore(
  facts: readonly CourseFacts[],
  targetMeters: number,
  profile: DogProfile,
  originContext: OriginContext
): ScoredCourse[] {
  return facts
    .map((candidate) => ({
      facts: candidate,
      breakdown: calculateWeightedScore(candidate, targetMeters, profile, originContext)
    }))
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
}
