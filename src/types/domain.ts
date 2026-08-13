export type DogPersonalityTag =
  | "afraid_of_people"
  | "afraid_of_cars"
  | "likes_parks"
  | "likes_people"
  | "likes_new_routes"
  | "likes_quiet_routes";

export type DogSocialPreference = "likes_dogs" | "avoids_dogs" | "neutral";

export type WalkDistanceOption = "minimum" | "recommended" | "custom";

export type CareTaskType = "walk" | "feed" | "medicine";

export type RiskZoneType =
  | "traffic"
  | "accident"
  | "air_quality"
  | "heat"
  | "deicer"
  | "user_report";

/**
 * Weight-derived size bucket used for base walk duration/speed lookups
 * (spec 5.2). Always computed from `dogs.weight_kg` at request time, never
 * from breed metadata.
 */
export type DogSizeClass = "toy" | "small" | "medium" | "large" | "giant";

/** Royal Kennel Club style daily-exercise grade (spec 5.2, 8). */
export type KcExerciseGrade =
  | "up_to_30_min"
  | "up_to_1_hour"
  | "up_to_2_hours"
  | "over_2_hours";

/**
 * Life stage bucket driving the age duration multiplier (spec 5.2) and the
 * senior-only stair/slope filters (spec 3.3). `senior` onset age depends on
 * `DogSizeClass` (large 7y / medium 8y / small & toy 10y / giant 7y);
 * `geriatric` is the senior onset age + 4 years.
 */
export type DogLifeStage =
  | "puppy"
  | "young_adult"
  | "adult"
  | "senior"
  | "geriatric";

/** Self-reported activity level from the personality survey (spec 3.4, 5.2). */
export type DogActivityLevel = "low" | "normal" | "high";

/**
 * GraphHopper `road_class` encoded value, as produced from OSM `highway`
 * tags. Upper-case to match GraphHopper custom model condition syntax
 * (`road_class == PRIMARY`), distinct from `RoadSegmentClass` which is the
 * lower-case value stored in `road_segments.road_class`.
 */
export type GraphHopperRoadClass =
  | "MOTORWAY"
  | "TRUNK"
  | "PRIMARY"
  | "SECONDARY"
  | "TERTIARY"
  | "RESIDENTIAL"
  | "LIVING_STREET"
  | "FOOTWAY"
  | "PEDESTRIAN"
  | "STEPS"
  | "OTHER";

/** `road_segments.road_class` value, matching the migration's check constraint. */
export type RoadSegmentClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "residential"
  | "living_street"
  | "footway"
  | "pedestrian"
  | "steps"
  | "other";

/** Warning severity produced by the warning-check pipeline (spec 5.1). */
export type WarningLevel = "normal" | "caution" | "danger";

/** Warning categories the pipeline can raise (spec 5.1, 3.5). */
export type WarningType =
  | "pm10"
  | "pm25"
  | "heat"
  | "cold"
  | "precipitation"
  | "summer_daytime_heat"
  | "winter_deicer";

/** `pet_facilities.facility_type` value (spec 6). */
export type PetFacilityType = "playground" | "hospital" | "grooming" | "cafe" | "other";

/** `streetlights.light_type` value (spec 6). */
export type StreetlightType = "streetlight" | "security_light";

/** The 8-way compass bin used for course direction diversity (spec 5.3). */
export type BearingBin = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Coarse part-of-day bucket used in the recommendation cache key
 * (spec 7.3: "시간대(오전/오후/저녁)"). */
export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Which of the three duration options (spec 5.2) a request selected. */
export type DurationChoice = "minimum" | "recommended" | "custom";
