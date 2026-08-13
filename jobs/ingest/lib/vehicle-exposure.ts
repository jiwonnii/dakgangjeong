/**
 * 차량 노출도 자동 산출 (spec 5.6 1차 필터가 소비하는
 * `road_segments.vehicle_exposure`의 원천 계산식). This is the exact
 * formula worked out earlier in this project's research (국가표준노드링크
 * ROAD_RANK 기준값 + LANES/MAX_SPD 보정 + 보행자전용/우선·스쿨존·
 * 과속방지턱 덮어쓰기), reused verbatim here so ingest-road-segments.ts's
 * initial pass and its overlay-recompute pass (phase 3) share one
 * implementation instead of duplicating the formula in SQL.
 *
 * Keyed by `RoadSegmentClass` (not raw ROAD_RANK) so this same function
 * works both at initial ingest (road class just computed from ROAD_RANK)
 * and at the recompute pass after overlay flags are set (road class read
 * back from the DB row, where the original ROAD_RANK code is no longer
 * available — road_segments has no roadRank column, only the class it
 * implies).
 */

import type { RoadSegmentClass } from "../../../src/types/domain.js";

/** 국가표준노드링크 ROAD_RANK 코드 → RoadSegmentClass. 101/102(고속도로·
 * 도시고속화도로)는 도보 코스 후보에서 아예 제외한다. */
export const ROAD_RANK_TO_ROAD_CLASS: Readonly<Record<string, RoadSegmentClass>> = {
  "101": "motorway",
  "102": "trunk",
  "103": "primary",
  "104": "secondary",
  "105": "tertiary",
  "106": "tertiary",
  "107": "residential",
  "108": "other"
};

export function isRoadRankWalkable(roadRank: string): boolean {
  return roadRank !== "101" && roadRank !== "102";
}

/** ROAD_RANK 기준값 (spec 초안 "차량 노출도 자동 산출"). motorway/trunk는
 * isRoadRankWalkable()로 이미 걸러지므로 여기 값은 사용되지 않는다 —
 * 완전성을 위해 최댓값으로 채워둔다. living_street/footway/pedestrian/
 * steps는 ROAD_RANK 표에 없는 클래스라(OSM 등 다른 출처 전용) 낮은 기본값을
 * 부여해뒀다 — 실제로는 대부분 보행자전용/우선 덮어쓰기로 확정된다. */
const ROAD_CLASS_BASE_EXPOSURE: Readonly<Record<RoadSegmentClass, number>> = {
  motorway: 5.0,
  trunk: 5.0,
  primary: 5.0,
  secondary: 4.0,
  tertiary: 3.5,
  residential: 2.5,
  living_street: 1.0,
  footway: 0.5,
  pedestrian: 0.5,
  steps: 0.5,
  other: 2.0
};

const LANES_HIGH_THRESHOLD = 6;
const LANES_HIGH_ADJUSTMENT = 1.0;
const LANES_LOW_THRESHOLD = 2;
const LANES_LOW_ADJUSTMENT = -0.5;

const SPEED_HIGH_THRESHOLD_KMH = 60;
const SPEED_HIGH_ADJUSTMENT = 1.0;
const SPEED_LOW_THRESHOLD_KMH = 30;
const SPEED_LOW_ADJUSTMENT = -1.0;

const PEDESTRIAN_ONLY_OVERRIDE = 0.0;
const PEDESTRIAN_PRIORITY_OVERRIDE = 0.5;
const SCHOOL_ZONE_ADJUSTMENT = -1.0;
const SPEED_BUMP_ADJUSTMENT = -0.5;

const EXPOSURE_MIN = 0;
const EXPOSURE_MAX = 5;

export type VehicleExposureInput = {
  roadClass: RoadSegmentClass;
  lanes: number | null;
  maxSpeedKmh: number | null;
  isPedestrianOnly: boolean;
  isPedestrianPriority: boolean;
  isSchoolZone: boolean;
  hasSpeedBump: boolean;
};

export function calculateVehicleExposure(input: VehicleExposureInput): number {
  if (input.isPedestrianOnly) {
    return PEDESTRIAN_ONLY_OVERRIDE;
  }

  if (input.isPedestrianPriority) {
    return PEDESTRIAN_PRIORITY_OVERRIDE;
  }

  let exposure = ROAD_CLASS_BASE_EXPOSURE[input.roadClass];

  if (input.lanes !== null) {
    if (input.lanes >= LANES_HIGH_THRESHOLD) {
      exposure += LANES_HIGH_ADJUSTMENT;
    } else if (input.lanes <= LANES_LOW_THRESHOLD) {
      exposure += LANES_LOW_ADJUSTMENT;
    }
  }

  if (input.maxSpeedKmh !== null) {
    if (input.maxSpeedKmh >= SPEED_HIGH_THRESHOLD_KMH) {
      exposure += SPEED_HIGH_ADJUSTMENT;
    } else if (input.maxSpeedKmh <= SPEED_LOW_THRESHOLD_KMH) {
      exposure += SPEED_LOW_ADJUSTMENT;
    }
  }

  if (input.isSchoolZone) {
    exposure += SCHOOL_ZONE_ADJUSTMENT;
  }

  if (input.hasSpeedBump) {
    exposure += SPEED_BUMP_ADJUSTMENT;
  }

  return Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, exposure));
}
