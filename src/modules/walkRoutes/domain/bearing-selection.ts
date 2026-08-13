/**
 * 방위 선정 (spec 5.3): turns a per-bin road count into the top bearings a
 * round_trip should be generated toward, plus the coverage gate used to
 * decide whether a location has enough road data to recommend at all
 * (spec 2.4, 5.7 — "명지대 권역과 같이 도로 밀도가 낮은 지역은 1~2개만
 * 제시"). Pure function: the actual road counts are fetched by
 * services/bearing.service.ts from `bearing_grid` (or computed live on a
 * cache miss) and passed in here already tallied.
 */

import type { BearingBin } from "../../../types/domain";
import {
  BEARING_BIN_LABELS_KO,
  bearingBinToCenterDegrees
} from "../../../lib/geo";
import {
  BEARING_CANDIDATE_COUNT,
  BEARING_MIN_ROAD_COUNT,
  MIN_ROAD_COUNT_FOR_COVERAGE
} from "../../../constants/walk-tuning";

export type RoadCountsByBearing = Record<BearingBin, number>;

export const EMPTY_ROAD_COUNTS_BY_BEARING: RoadCountsByBearing = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
  7: 0
};

export type SelectedBearing = {
  bin: BearingBin;
  degrees: number;
  labelKo: string;
  roadCount: number;
};

/**
 * Total road count across all 8 bins — the signal for the hard coverage
 * gate (spec 2.4). Distinct from BEARING_MIN_ROAD_COUNT, which gates a
 * single direction rather than the location as a whole.
 */
export function calculateTotalRoadCount(roadCounts: RoadCountsByBearing): number {
  return Object.values(roadCounts).reduce((sum, count) => sum + count, 0);
}

/**
 * True when there is enough road data near the origin to attempt a
 * recommendation at all. When false, the caller (recommendation.service.ts,
 * round 10) should return an explicit "이 지역은 데이터가 부족합니다"
 * response instead of running the rest of the pipeline.
 */
export function isCoverageSufficient(roadCounts: RoadCountsByBearing): boolean {
  return calculateTotalRoadCount(roadCounts) >= MIN_ROAD_COUNT_FOR_COVERAGE;
}

/**
 * Selects up to BEARING_CANDIDATE_COUNT bearings to generate round_trip
 * candidates toward, per spec 5.3 steps 3-4: highest road count first,
 * excluding any bin with fewer than BEARING_MIN_ROAD_COUNT roads. Returns
 * fewer than BEARING_CANDIDATE_COUNT entries when the area is too sparse
 * in most directions — this is exactly the mechanism spec 5.7 relies on to
 * naturally produce 1~2 courses instead of 3 in low-density areas, with no
 * separate "reduce course count" logic needed elsewhere.
 */
export function selectTopBearings(roadCounts: RoadCountsByBearing): SelectedBearing[] {
  const eligible = (Object.entries(roadCounts) as Array<[string, number]>)
    .map(([binKey, roadCount]) => ({
      bin: Number(binKey) as BearingBin,
      roadCount
    }))
    .filter((entry) => entry.roadCount >= BEARING_MIN_ROAD_COUNT)
    .sort((a, b) => b.roadCount - a.roadCount)
    .slice(0, BEARING_CANDIDATE_COUNT);

  return eligible.map((entry) => ({
    bin: entry.bin,
    degrees: bearingBinToCenterDegrees(entry.bin),
    labelKo: BEARING_BIN_LABELS_KO[entry.bin],
    roadCount: entry.roadCount
  }));
}
