/**
 * Every tunable coefficient, threshold, and default from
 * docs/walk-recommendation-spec.md in one place. Nothing in this file makes
 * a decision by itself — domain modules (src/modules/walkRoutes/domain/*)
 * read these values and apply them. Change a number here, not in the logic.
 *
 * Section references (e.g. "5.2") point at the spec section that documents
 * the value.
 */

import type {
  DogActivityLevel,
  DogLifeStage,
  DogSizeClass,
  GraphHopperRoadClass,
  KcExerciseGrade
} from "../types/domain";

// ---------------------------------------------------------------------------
// 5.2 목표 시간 계산 — base duration, multipliers, bounds, speed
// ---------------------------------------------------------------------------

/** 1회 기본값 (체급별), minutes. */
export const BASE_DURATION_MINUTES_BY_SIZE_CLASS: Record<DogSizeClass, number> = {
  toy: 25,
  small: 25,
  medium: 30,
  large: 30,
  giant: 25
};

/** 견종 계수 (Royal Kennel Club 4단계 등급). */
export const KC_GRADE_DURATION_MULTIPLIER: Record<KcExerciseGrade, number> = {
  up_to_30_min: 0.7,
  up_to_1_hour: 1.0,
  up_to_2_hours: 1.3,
  over_2_hours: 1.6
};

/** 나이 계수. Life stage is derived per-dog in dog-profile.ts using the
 * size-class-dependent senior onset age below. */
export const AGE_STAGE_DURATION_MULTIPLIER: Record<DogLifeStage, number> = {
  puppy: 0.6,
  young_adult: 1.3,
  adult: 1.0,
  senior: 0.6,
  geriatric: 0.45
};

/** 단두종 계수 (3.2 활동량 저하 실측 근거). Applied multiplicatively on top
 * of the age/size/KC-grade product when the breed is brachycephalic. */
export const BRACHYCEPHALIC_DURATION_MULTIPLIER = 0.7;

/** 활발함 계수 (3.4, 5.2). `normal` is the default until the personality
 * survey ships the activity-level question (spec 8, 미확정 항목). */
export const ACTIVITY_LEVEL_DURATION_MULTIPLIER: Record<DogActivityLevel, number> = {
  low: 0.8,
  normal: 1.0,
  high: 1.2
};

export const DEFAULT_ACTIVITY_LEVEL: DogActivityLevel = "normal";

/** 노령 기준 (3.3): age in years at which a dog of this size class becomes
 * "senior". `geriatric` onset = this value + GERIATRIC_AGE_OFFSET_YEARS. */
export const SENIOR_ONSET_AGE_YEARS_BY_SIZE_CLASS: Record<DogSizeClass, number> = {
  toy: 10,
  small: 10,
  medium: 8,
  large: 7,
  giant: 7
};

/** 초고령 = 노령 기준 + 4세 (3.3). */
export const GERIATRIC_AGE_OFFSET_YEARS = 4;

/** young_adult 은 1~3세, adult 은 4세부터 노령 기준 전까지 (5.2). The
 * young_adult/adult boundary is fixed at 4 years regardless of size class;
 * only the senior/geriatric boundaries vary by size class. */
export const YOUNG_ADULT_MIN_AGE_YEARS = 1;
export const ADULT_MIN_AGE_YEARS = 4;

/** 최소 = max(20분, 적정 × 0.6). 상한 = 적정 × 배수 (퍼피·노령견은 더 낮은 배수).
 *
 * 2026-08-12: 바닥값을 10 → 20분으로 올렸다. GraphHopper round_trip 은 짧은
 * 거리에서 크게 빗나간다 — 실측으로 500m 요청 시 +26%, 1km 요청 시 +6% 였다.
 * 보행 속도 2.0~3.5km/h 기준 10분은 333~583m 라 오차가 가장 심한 구간에
 * 정확히 들어가서, 노령 소형견의 "최소 산책"이 쓸 수 없는 코스로 나왔다.
 * 20분이면 소형견도 667m 다. 그보다 짧게 걷고 싶으면 코스를 만들지 않는
 * "자유 산책"이 담당한다.
 *
 * 2026-08-10: 사용자 요청으로 "커스텀 산책 시간 최대 4시간 정도는 선택 가능해야
 * 함" — route-generation.service.ts는 시간대별 별도 전략 없이 GraphHopper
 * round_trip.distance만 다르게 요청하는 구조라(30분/1시간/2시간 전용 분기 없음),
 * 이 두 배수만 올리면 새 설계 없이 반영됨. DEFAULT를 1.5→4.0으로 올려서 활발한
 * 성견(kc_grade 상위 + activity high)은 최대 약 3.5~4시간까지, 평범한 성견도
 * 최대 약 2시간까지 나오도록 함. RESTRICTED(퍼피·노령견·초고령견)는 안전을 위해
 * 훨씬 보수적으로 1.2→2.0만 올림 — 무제한으로 같이 올리면 원래 이 구분을 둔
 * 의도(과도한 장시간 산책 방지)가 무너짐. */
export const MINIMUM_DURATION_FLOOR_MINUTES = 20;
export const MINIMUM_DURATION_RATIO = 0.6;
export const MAXIMUM_DURATION_RATIO_DEFAULT = 4.0;
export const MAXIMUM_DURATION_RATIO_RESTRICTED = 2.0;

/** 시간-거리 변환 속도 (5.2), km/h, keyed by the lower bound (kg) of each
 * weight band. Resolve with `resolveWalkingSpeedKmh` below. */
export const WALKING_SPEED_KMH_BY_WEIGHT_BAND: ReadonlyArray<{
  minWeightKg: number;
  speedKmh: number;
}> = [
  { minWeightKg: 0, speedKmh: 2.0 },
  { minWeightKg: 5, speedKmh: 2.5 },
  { minWeightKg: 10, speedKmh: 3.0 },
  { minWeightKg: 25, speedKmh: 3.5 }
];

/** 노령견 = 위 속도 × 0.8 (5.2). */
export const SENIOR_WALKING_SPEED_MULTIPLIER = 0.8;

/** 체급 판정 체중 상한 (kg), used to derive DogSizeClass from weight_kg.
 * Bands mirror WALKING_SPEED_KMH_BY_WEIGHT_BAND but size class distinguishes
 * "large" (10~25kg) from the base-duration table's separate "giant" bucket,
 * which the spec's weight table does not split — giant is therefore treated
 * as anything at or above the giant threshold below. */
export const SIZE_CLASS_WEIGHT_THRESHOLDS_KG: ReadonlyArray<{
  maxWeightKg: number;
  sizeClass: DogSizeClass;
}> = [
  { maxWeightKg: 5, sizeClass: "toy" },
  { maxWeightKg: 10, sizeClass: "small" },
  { maxWeightKg: 25, sizeClass: "medium" },
  { maxWeightKg: 40, sizeClass: "large" },
  { maxWeightKg: Number.POSITIVE_INFINITY, sizeClass: "giant" }
];

// ---------------------------------------------------------------------------
// 5.1 경고 체크 — thresholds and per-dog offsets
// ---------------------------------------------------------------------------

/** PM10 (µg/m³): caution starts here, danger starts at PM10_DANGER_MIN. */
export const PM10_CAUTION_MIN = 81;
export const PM10_DANGER_MIN = 151;

/** PM2.5 (µg/m³). */
export const PM25_CAUTION_MIN = 36;
export const PM25_DANGER_MIN = 76;

/** 체감온도 더위 (°C): caution starts here, danger starts at HEAT_DANGER_MIN_C. */
export const HEAT_CAUTION_MIN_C = 28;
export const HEAT_DANGER_MIN_C = 31;

/** 체감온도 추위 (°C): caution at or below this, danger at or below
 * COLD_DANGER_MAX_C. */
export const COLD_CAUTION_MAX_C = 0;
export const COLD_DANGER_MAX_C = -6;

/** 견종·나이별 기준 조정 (5.1). Offsets are added to the base thresholds
 * above before comparison — e.g. a brachycephalic dog's effective heat
 * caution threshold is HEAT_CAUTION_MIN_C + BRACHYCEPHALIC_HEAT_OFFSET_C. */
export const BRACHYCEPHALIC_HEAT_OFFSET_C = -3;
export const DOUBLE_COAT_HEAT_OFFSET_C = -2;
export const SMALL_BREED_COLD_OFFSET_C = 3;
export const SMALL_BREED_COLD_OFFSET_MAX_WEIGHT_KG = 5;
export const PUPPY_OR_SENIOR_HEAT_OFFSET_C = -2;
export const PUPPY_OR_SENIOR_COLD_OFFSET_C = 2;

/** 여름 주간 처리 (5.1): 체감온도 >= this AND hour in [start, end]
 * (inclusive) → time-change warning instead of a course change. */
export const SUMMER_DAYTIME_HEAT_THRESHOLD_C = 28;
export const SUMMER_DAYTIME_START_HOUR = 12;
export const SUMMER_DAYTIME_END_HOUR = 17;

/** 겨울 제설제: 강설 후 안내를 유지하는 일수. */
export const WINTER_DEICER_WARNING_DAYS = 3;

/** Was: 경고 발생 시 목표 시간에 곱하는 단축 계수 (spec 5.1/3.5's caution/
 * danger duration cut). Disabled 2026-08-10 by user decision — warnings are
 * banner-only now, `warning-check.ts`'s `evaluateWarnings` always returns
 * `durationPenaltyRatio: 1` regardless of level, so this constant is no
 * longer imported anywhere. Left here (not deleted) in case that decision
 * is revisited — re-wire it in `evaluateWarnings` to bring it back. */
export const WARNING_DURATION_PENALTY_RATIO: Record<"caution" | "danger", number> = {
  caution: 0.8,
  danger: 0.5
};

// ---------------------------------------------------------------------------
// 5.3 방위 선정
// ---------------------------------------------------------------------------

export const BEARING_SEARCH_RADIUS_M = 300;
export const BEARING_CANDIDATE_COUNT = 3;
export const BEARING_MIN_ROAD_COUNT = 8;
export const BEARING_GRID_CELL_SIZE_M = 200;

/** 8방위 경계 각도(도), bin index 0=북 ... 7=북서, 45° 폭으로 등분. */
export const BEARING_BIN_WIDTH_DEGREES = 45;
export const BEARING_BIN_COUNT = 8;

// ---------------------------------------------------------------------------
// 5.4 코스 생성 — round_trip parameters and custom model priorities
// ---------------------------------------------------------------------------

export const WAYPOINT_COUNT_MIN = 2;
export const WAYPOINT_COUNT_MAX = 20;
export const WAYPOINT_COUNT_DISTANCE_DIVISOR_M = 50000;

/** seed 값 목록 (방위당). 4개 사용 → 3방위 × 4 seed = 후보 12개.
 * GraphHopper round_trip 이 서로 다른 heading 에도 같은 루프를 돌려주는
 * 경우가 있어서, 최종 3순위까지 채울 수 있도록 로컬 후보 풀을 넓힌다. */
export const ROUTE_SEEDS_PER_BEARING: readonly number[] = [1, 2, 3, 4];

export const DISTANCE_INFLUENCE_DEFAULT = 70;

/** 기본 커스텀 모델 priority 배수 (5.4). */
export const ROAD_CLASS_PRIORITY_MULTIPLIER: Record<GraphHopperRoadClass, number> = {
  STEPS: 0,
  MOTORWAY: 0,
  TRUNK: 0,
  PRIMARY: 0.15,
  SECONDARY: 0.3,
  TERTIARY: 0.5,
  RESIDENTIAL: 0.8,
  LIVING_STREET: 1.3,
  FOOTWAY: 1.5,
  PEDESTRIAN: 1.5,
  OTHER: 1.0
};

/** 개체별 오버라이드 (5.4 개체별 오버라이드 표). */
export const CAR_FEAR_PRIMARY_MULTIPLIER = 0.05;
export const CAR_FEAR_SECONDARY_MULTIPLIER = 0.1;
export const PARK_PREFERENCE_AREA_MULTIPLIER = 2.0;
export const SENIOR_SLOPE_THRESHOLD_DEGREES = 4;
export const SENIOR_SLOPE_MULTIPLIER = 0.2;
export const LARGE_BREED_SLOPE_THRESHOLD_DEGREES = 6;
export const LARGE_BREED_SLOPE_MULTIPLIER = 0.3;
export const NIGHT_LIT_MULTIPLIER = 1.3;

/** 저녁 판정 (spec 3.5 "저녁 | 탐색 | lit==true → priority 1.3"). The spec
 * does not give exact hour boundaries for "저녁" the way it does for the
 * summer-daytime rule (12~17시) — 18시(해질 무렵)~다음날 05시대(해뜨기 전)
 * as "evening or night" is a reasonable, if not spec-literal, choice,
 * documented here as a deliberate judgment call rather than left implicit
 * in custom-model.ts. Hour comparisons must use KST (src/lib/kst-time.ts),
 * never the server process's local timezone. */
export const EVENING_OR_NIGHT_START_HOUR = 18;
export const EVENING_OR_NIGHT_END_HOUR = 6;

/** 오전/오후 경계 (spec 7.3 캐시 키 "시간대(오전/오후/저녁)"). Not given
 * numerically in the spec. 저녁 재사용: EVENING_OR_NIGHT_START_HOUR(18시)
 * 이후는 저녁, MORNING_END_HOUR 이전은 오전, 그 사이는 오후. */
export const MORNING_END_HOUR = 12;

/** GeoJSON area id used when injecting nearby park polygons into the
 * custom model (5.4 커스텀 모델 제약: areas는 Polygon만, [경도, 위도] 순). */
export const CUSTOM_MODEL_PARK_AREA_ID_PREFIX = "nearby_park_";

/** Name of the GraphHopper server profile (config.yml `profiles:` entry)
 * this app's custom models are applied on top of. Must match the deployed
 * GraphHopper instance's configuration — see graphhopper-client.ts's
 * verification caveat. */
export const GRAPHHOPPER_FOOT_PROFILE_NAME = "foot_custom";

/** Radius used to search for nearby parks to inject as custom-model areas
 * (round 7), as a ratio of the target route distance — a round_trip loop's
 * maximum extent from the origin is roughly half its total length, so
 * searching a bit beyond that comfortably covers parks the route could
 * plausibly pass near. Not specified numerically in the spec; capped at
 * PARK_SEARCH_RADIUS_MAX_M so very long routes don't pull in an unbounded
 * number of parks. */
export const PARK_SEARCH_RADIUS_RATIO = 0.6;
export const PARK_SEARCH_RADIUS_MAX_M = 3000;

// ---------------------------------------------------------------------------
// 5.5 사후 채점 — PostGIS radii and lookback windows
// ---------------------------------------------------------------------------

export const TREE_SEARCH_RADIUS_M = 20;
export const BENCH_SEARCH_RADIUS_M = 15;
export const DIVERSITY_LOOKBACK_DAYS = 7;

/** Search radius for "개 마주칠 확률" 시설 근접 요소 (spec 5.5). Not given
 * numerically in the spec; 300m is roughly a 3~4 minute walk, which felt
 * like a reasonable "nearby" for a facility to plausibly matter to a route
 * passing close to it. */
export const PET_FACILITY_SEARCH_RADIUS_M = 300;

/** Width of the buffer corridor drawn around a historical walk_records
 * route before intersecting it with a new candidate to approximate
 * "다양성" overlap length (spec 5.5) — see migration 0006's comment for
 * why raw LineString-LineString intersection does not work for this. */
export const DIVERSITY_CORRIDOR_WIDTH_M = 15;

/** Tolerance used to match a GraphHopper-generated candidate path back to
 * our own `road_segments` rows for the length-weighted 차량 노출도
 * average (spec 5.6 1차 필터 "차량 노출 낮은 순 정렬"). Both datasets
 * should trace the same physical streets, but come from independently
 * ingested/snapped geometries, so an exact-coincidence match would miss
 * segments that are the same road but off by a few meters. */
export const ROAD_SEGMENT_MATCH_BUFFER_M = 15;

/** Matching tolerance used at ingest time (11회차) to decide whether a
 * pedestrian-only/우선도로/스쿨존/과속방지턱/보안등 overlay feature applies
 * to a given road_segments row. Reuses the same order-of-magnitude
 * reasoning as ROAD_SEGMENT_MATCH_BUFFER_M (independently-sourced
 * geometries of the same physical road rarely align to better than a few
 * meters), kept as a separate constant since ingest-time matching and
 * request-time GraphHopper-path matching are conceptually different
 * operations that happen to want a similar tolerance today. */
export const ROAD_OVERLAY_MATCH_BUFFER_M = 15;

// ---------------------------------------------------------------------------
// 5.6 채점 공식
// ---------------------------------------------------------------------------

/** 1차 계층 필터: 거리 허용 오차 비율.
 *
 * ⚠️ TEMPORARILY WIDENED 2026-08-10 from the spec's ±20% (0.2) to ±50%
 * (0.5) — confirmed via live GraphHopper round_trip testing that this
 * project's original 0.2 was chosen before any real GraphHopper instance
 * existed, and doesn't hold: at a ~1.5km target near central Seoul,
 * round_trip.distance=1458 produced real candidates at 1929-2150m
 * (32-47% over), not within ±20%, causing every request to return
 * no_courses_found. The overshoot doesn't look like a constant ratio
 * either — separate manual tests at the same location showed 500m→630m
 * (+26%), 1000m→1059m (+6%), 2000m→1771m (-11%), 3000m→2674m (-11%), i.e.
 * it's worse at small target distances. The real fix is likely either a
 * distance-dependent correction factor on the round_trip.distance request
 * in route-generation.service.ts, or recalibrating this ratio against a
 * larger sample — 0.5 is a stopgap to unblock testing, not a calibrated
 * value. Revisit before this ships. */
export const DISTANCE_FILTER_TOLERANCE_RATIO = 0.5;

/** 2차 3축 가중치의 적합도 정규화 분모 비율 (목표거리 × 0.5). */
export const FIT_SCORE_NORMALIZATION_RATIO = 0.5;

export type ScoreWeightProfile = {
  safety: number;
  comfort: number;
  fit: number;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeightProfile = { safety: 40, comfort: 30, fit: 30 };
export const CAR_FEAR_SCORE_WEIGHTS: ScoreWeightProfile = { safety: 60, comfort: 20, fit: 20 };
export const PARK_PREFERENCE_SCORE_WEIGHTS: ScoreWeightProfile = {
  safety: 40,
  comfort: 45,
  fit: 15
};
export const TIMID_SCORE_WEIGHTS: ScoreWeightProfile = { safety: 55, comfort: 25, fit: 20 };

/** 정규화 상한값. 차량노출·횡단보도·가로수는 이 값에서 0~1로 스케일된다. */
export const VEHICLE_EXPOSURE_MAX = 5;
export const CROSSWALK_COUNT_NORMALIZATION_MAX = 6;
export const TREES_PER_KM_NORMALIZATION_MAX = 60;

/** Score-based route ranking. These weights intentionally mirror the
 * product priority order: crash/risk zones first, vehicle exposure second,
 * pedestrian hazards third, then comfort/personality signals. Distance fit
 * is small because distance is already handled by the hard filter. */
export type RouteScoreWeightProfile = {
  riskZones: number;
  vehicleExposure: number;
  pedestrianSafety: number;
  environment: number;
  familiarity: number;
  fit: number;
};

export const ROUTE_SCORE_WEIGHTS: RouteScoreWeightProfile = {
  riskZones: 35,
  vehicleExposure: 25,
  pedestrianSafety: 15,
  environment: 10,
  familiarity: 10,
  fit: 5
};

export const RISK_ZONE_COUNT_NORMALIZATION_MAX = 3;
export const PEDESTRIAN_HAZARD_COUNT_NORMALIZATION_MAX = 6;
export const BENCH_COUNT_NORMALIZATION_MAX = 6;

/** road_segments 매칭이 하나도 없어(데이터 공백) vehicle_exposure_avg가
 * null일 때 쓰는 대체값. VEHICLE_EXPOSURE_MAX(가장 나쁜 값)로 취급해
 * 데이터가 없는 구간이 안전 점수에서 유리해지는 일이 없게 한다 — 없는
 * 데이터를 "0(완전 안전)"으로 기본값 처리하는 쪽이 훨씬 위험하다. */
export const VEHICLE_EXPOSURE_FALLBACK_WHEN_UNMATCHED = VEHICLE_EXPOSURE_MAX;

/** 개 마주칠 확률 (spec 5.5) 합성 공식의 정규화 상한·가중치. 명세서에
 * 숫자가 없어 직접 정한 값 — 근거는 각 상수 옆 주석 참고. */
export const DOG_DENSITY_NORMALIZATION_MAX_PER_SQKM = 500;
export const PET_FACILITY_COUNT_NORMALIZATION_MAX = 5;

export const DOG_ENCOUNTER_WEIGHTS = {
  density: 0.4,
  facilities: 0.3,
  parkRatio: 0.3
} as const;

// ---------------------------------------------------------------------------
// 5.7 최종 선정
// ---------------------------------------------------------------------------

export const FINAL_COURSE_COUNT = 3;

// ---------------------------------------------------------------------------
// 12회차: TMAP 비동기 검증
// ---------------------------------------------------------------------------

/** TMAP 보행자 경로안내 passList 파라미터에 넣을 경유점 최대 개수. TMAP
 * 문서에 명시된 상한을 이 세션에서 확인하지는 못했다 — 우리 GraphHopper
 * 경로가 수십 개 점을 가질 수 있어 다운샘플링이 필요하다는 것만 확실해서,
 * 안전하게 작은 값으로 잡아뒀다. */
export const TMAP_MAX_PASS_LIST_POINTS = 10;

/** TMAP facilityType 코드 (spec 4.2 — 이 프로젝트가 실제로 TMAP 문서에서
 * 확인한 코드표). */
export const TMAP_FACILITY_TYPE = {
  BRIDGE: 1,
  TUNNEL: 2,
  ELEVATED_ROAD: 3,
  GENERAL_SIDEWALK: 11,
  OVERPASS: 12,
  UNDERPASS: 14,
  CROSSWALK: 15,
  LARGE_FACILITY_PASSAGE: 16,
  STEPS: 17
} as const;

// ---------------------------------------------------------------------------
// 7.3 캐시 TTL
// ---------------------------------------------------------------------------

export const RECOMMENDATION_CACHE_TTL_SECONDS = 6 * 60 * 60;
export const WEATHER_CACHE_TTL_SECONDS = 60 * 60;
export const AIR_QUALITY_CACHE_TTL_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// 2. 서비스 지역 — coverage gate and Yongin service circle
// ---------------------------------------------------------------------------

/** 반경 300m 도로 수가 이 값 미만이면 커버리지 부족으로 안내한다
 * (5.7 "명지대 권역과 같이 도로 밀도가 낮은 지역은 1~2개만 제시"의 판정
 * 기준). Reuses BEARING_MIN_ROAD_COUNT's search radius but is a distinct
 * concept: this gates the whole request, bearing selection gates one
 * direction. */
export const MIN_ROAD_COUNT_FOR_COVERAGE = 30;

export const MYONGJI_CAMPUS_CENTER = { lat: 37.221, lon: 127.1865 } as const;
export const MYONGJI_SERVICE_RADIUS_M = 3000;

/** 서울특별시청 기준 좌표 및 서울 전역을 커버하는 대략 반경. Seoul's
 * boundary is irregular, so this is only used as a coarse pre-filter before
 * the precise coverage/road-count check runs; it must never reject a point
 * that later passes MIN_ROAD_COUNT_FOR_COVERAGE.
 *
 * 20km was chosen over a larger "just to be safe" radius deliberately:
 * the actual distance from City Hall to Seoul's farthest administrative
 * boundaries is ~15-18km in every direction, so 20km already gives a ~2x
 * area safety margin (1257km² circle vs Seoul's actual 605km²). An earlier
 * draft used 32km, which produces a 3217km² circle — over 5x Seoul's area
 * — and was caught during round-5 verification generating roughly 80,000
 * grid cells for the bearing_grid batch instead of the ~30,000 this value
 * produces, for no added correctness. */
export const SEOUL_CITY_HALL_CENTER = { lat: 37.5665, lon: 126.978 } as const;
export const SEOUL_COARSE_RADIUS_M = 20000;
