/**
 * 5.6절 1차 구현: 계층 필터. Two separable concerns:
 *
 *   1. applyHardFilters — gates that must always run regardless of which
 *      ranking strategy is used downstream (거리 범위, 계단 배제). A
 *      course 3x too long, or one a stair-restricted dog cannot safely
 *      use, should never be selectable no matter how well it scores on
 *      other axes.
 *   2. rankByHierarchicalFilter — the lexicographic sort spec 5.6 calls
 *      "1차 구현" itself: 차량노출 → 가로수 → 공원, in that priority
 *      order, no weights to tune. This is a complete, standalone ranking
 *      strategy — scoring-weighted.ts's "2차 확장" is an alternative to
 *      this function, not a wrapper around it. Both consume the same
 *      hard-filtered input from applyHardFilters.
 */

import {
  DISTANCE_FILTER_TOLERANCE_RATIO,
  VEHICLE_EXPOSURE_FALLBACK_WHEN_UNMATCHED
} from "../../../constants/walk-tuning";
import type { DogProfile } from "./dog-profile";
import type { CourseFacts } from "../services/scoring.service";

function isWithinDistanceTolerance(actualMeters: number, targetMeters: number): boolean {
  if (targetMeters <= 0) {
    throw new Error(`Invalid targetMeters for distance filter: ${targetMeters}`);
  }

  const relativeError = Math.abs(actualMeters - targetMeters) / targetMeters;
  return relativeError <= DISTANCE_FILTER_TOLERANCE_RATIO;
}

/**
 * Applies the two hard gates from spec 5.6 steps 1-2. Order matters only
 * for readability here — both conditions are independent AND-combined
 * filters, not a priority chain.
 *
 * @param enforceDistanceTolerance Defaults to true. The caller
 *   (recommendation.service.ts) sets this false on a second pass when the
 *   strict pass eliminates every candidate — GraphHopper's round_trip
 *   distance targeting is not precise (confirmed 2026-08-10, see
 *   DISTANCE_FILTER_TOLERANCE_RATIO's comment), and returning
 *   "no_courses_found" whenever every candidate happens to miss the ±50%
 *   window is a worse user experience than showing the closest-available
 *   course with an honest label. The stairs gate is never skipped — that
 *   one is a real safety constraint, not a distance-precision artifact.
 */
export function applyHardFilters(
  facts: readonly CourseFacts[],
  targetMeters: number,
  profile: DogProfile,
  enforceDistanceTolerance = true
): CourseFacts[] {
  return facts.filter((candidate) => {
    if (enforceDistanceTolerance && !isWithinDistanceTolerance(candidate.distanceMeters, targetMeters)) {
      return false;
    }

    if (profile.needsStairFilter && candidate.stepsCount > 0) {
      return false;
    }

    return true;
  });
}

/** vehicleExposureAvg is null when no road_segments matched near this
 * candidate (ingest gap). Treated as the worst (most cautious) value
 * rather than best, so missing data can never make a course look safer
 * than it might actually be — see the constant's own doc comment. */
function resolveVehicleExposure(candidate: CourseFacts): number {
  return candidate.vehicleExposureAvg ?? VEHICLE_EXPOSURE_FALLBACK_WHEN_UNMATCHED;
}

// Final ordering is lexicographic: risk-zone crossings, vehicle exposure,
// pedestrian hazards, then comfort/personality tie-breakers.

/**
 * Numeric comparator helper.
 * ties broken by higher park ratio. Does not compute a numeric score —
 * this is a pure ordering, which is exactly what makes it usable without
 * defining any weights (spec's stated reason for building this first).
 */
function compareAscending(a: number, b: number): number {
  return a - b;
}

function compareDescending(a: number, b: number): number {
  return b - a;
}

function isSeniorOrGeriatric(profile: DogProfile): boolean {
  return profile.lifeStage === "senior" || profile.lifeStage === "geriatric";
}

function pedestrianHazardScore(candidate: CourseFacts, profile: DogProfile): number {
  // Stairs only affect ranking for dogs whose profile makes stairs unsafe.
  // For other dogs, stair count is deliberately neutral.
  return profile.needsStairFilter ? candidate.stepsCount : 0;
}

function familiarityScore(candidate: CourseFacts, profile: DogProfile): number {
  // Adventurous dogs prefer less overlap with recent walks. Other dogs
  // prefer familiar routes when safety and comfort are otherwise tied.
  return profile.personality.isAdventurous
    ? 1 - candidate.diversityOverlapRatio
    : candidate.diversityOverlapRatio;
}

export function rankByHierarchicalFilter(
  facts: readonly CourseFacts[],
  profile: DogProfile
): CourseFacts[] {
  return [...facts].sort((a, b) => {
    const riskZoneDiff = compareAscending(a.riskZoneCount, b.riskZoneCount);
    if (riskZoneDiff !== 0) {
      return riskZoneDiff;
    }

    const exposureDiff = compareAscending(resolveVehicleExposure(a), resolveVehicleExposure(b));
    if (exposureDiff !== 0) {
      return exposureDiff;
    }

    const pedestrianHazardDiff = compareAscending(
      pedestrianHazardScore(a, profile),
      pedestrianHazardScore(b, profile)
    );
    if (pedestrianHazardDiff !== 0) {
      return pedestrianHazardDiff;
    }

    const treeDiff = compareDescending(a.treesPerKm, b.treesPerKm);
    if (treeDiff !== 0) {
      return treeDiff;
    }

    const parkDiff = compareDescending(a.parkRatio, b.parkRatio);
    if (parkDiff !== 0) {
      return parkDiff;
    }

    if (isSeniorOrGeriatric(profile)) {
      const benchDiff = compareDescending(a.benchCount, b.benchCount);
      if (benchDiff !== 0) {
        return benchDiff;
      }
    }

    return compareDescending(familiarityScore(a, profile), familiarityScore(b, profile));
  });
}
