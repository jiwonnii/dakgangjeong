/**
 * Normalizes a `dogs` row (plus its resolved breed metadata) into the single
 * `DogProfile` shape every other domain module in this pipeline reads from.
 * Pure function — no I/O. Callers (services/) are responsible for fetching
 * the dog row, its breed's AKC group name, and the current time.
 */

import type {
  DogActivityLevel,
  DogLifeStage,
  DogPersonalityTag,
  DogSizeClass,
  DogSocialPreference,
  KcExerciseGrade
} from "../../../types/domain";
import {
  ADULT_MIN_AGE_YEARS,
  DEFAULT_ACTIVITY_LEVEL,
  GERIATRIC_AGE_OFFSET_YEARS,
  SENIOR_ONSET_AGE_YEARS_BY_SIZE_CLASS,
  SENIOR_WALKING_SPEED_MULTIPLIER,
  SIZE_CLASS_WEIGHT_THRESHOLDS_KG,
  WALKING_SPEED_KMH_BY_WEIGHT_BAND,
  YOUNG_ADULT_MIN_AGE_YEARS
} from "../../../constants/walk-tuning";
import { resolveBreedExerciseProfile } from "../../../constants/breed-exercise-data";

/**
 * Free-text keywords in `dogs.health_notes` that indicate a condition the
 * stair filter should account for (spec 3.2: "질환 기재 개체"). `health_notes`
 * has no structured schema (see supabase/migrations/0001_init.sql), so this
 * is a best-effort keyword match, not a guaranteed classification — it is
 * documented here as a heuristic, not treated as ground truth elsewhere.
 */
const STAIR_RESTRICTING_HEALTH_KEYWORDS: readonly string[] = [
  "디스크",
  "IVDD",
  "ivdd",
  "추간판",
  "슬개골",
  "탈구",
  "고관절",
  "관절염",
  "관절 질환",
  "척추"
];

export function detectsStairRestrictingHealthCondition(healthNotes: string | null): boolean {
  if (!healthNotes) {
    return false;
  }

  const normalized = healthNotes.toLowerCase();
  return STAIR_RESTRICTING_HEALTH_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
}

export function resolveSizeClassFromWeight(weightKg: number): DogSizeClass {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error(`Invalid dog weight for size classification: ${weightKg}`);
  }

  const match = SIZE_CLASS_WEIGHT_THRESHOLDS_KG.find(
    (band) => weightKg <= band.maxWeightKg
  );

  if (!match) {
    // SIZE_CLASS_WEIGHT_THRESHOLDS_KG ends in Number.POSITIVE_INFINITY, so
    // this is unreachable for any finite positive weight.
    throw new Error(`No size class band matched weight ${weightKg}kg.`);
  }

  return match.sizeClass;
}

/** Whole months between `birthDateIso` (YYYY-MM-DD) and `now`, floored, and
 * never negative. Uses UTC calendar fields so the result does not depend on
 * the server's local timezone. */
export function calculateAgeInMonths(birthDateIso: string, now: Date): number {
  const birth = new Date(`${birthDateIso}T00:00:00Z`);

  if (Number.isNaN(birth.getTime())) {
    throw new Error(`Invalid birth date: ${birthDateIso}`);
  }

  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birth.getUTCMonth());

  if (now.getUTCDate() < birth.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Life stage bucket (spec 3.3, 5.2). Senior/geriatric onset ages depend on
 * `sizeClass`; the young_adult(1y)/adult(4y) boundary does not.
 */
export function resolveLifeStage(ageMonths: number, sizeClass: DogSizeClass): DogLifeStage {
  if (ageMonths < 12) {
    return "puppy";
  }

  const ageYears = ageMonths / 12;
  const seniorOnsetYears = SENIOR_ONSET_AGE_YEARS_BY_SIZE_CLASS[sizeClass];
  const geriatricOnsetYears = seniorOnsetYears + GERIATRIC_AGE_OFFSET_YEARS;

  if (ageYears >= geriatricOnsetYears) {
    return "geriatric";
  }

  if (ageYears >= seniorOnsetYears) {
    return "senior";
  }

  if (ageYears >= ADULT_MIN_AGE_YEARS) {
    return "adult";
  }

  if (ageYears >= YOUNG_ADULT_MIN_AGE_YEARS) {
    return "young_adult";
  }

  // ageMonths >= 12 implies ageYears >= 1 (YOUNG_ADULT_MIN_AGE_YEARS), so
  // this branch is unreachable, but keeps the function total.
  return "young_adult";
}

export function resolveWalkingSpeedKmh(weightKg: number, lifeStage: DogLifeStage): number {
  const band = [...WALKING_SPEED_KMH_BY_WEIGHT_BAND]
    .reverse()
    .find((candidate) => weightKg >= candidate.minWeightKg);

  const baseSpeedKmh = band?.speedKmh ?? WALKING_SPEED_KMH_BY_WEIGHT_BAND[0].speedKmh;
  const isSenior = lifeStage === "senior" || lifeStage === "geriatric";

  return isSenior ? baseSpeedKmh * SENIOR_WALKING_SPEED_MULTIPLIER : baseSpeedKmh;
}

/**
 * Personality-derived boolean flags consumed by the custom-model builder
 * (round 6) and the scoring stages (round 9), per the mapping in spec 3.4.
 * `isTimid` has no dedicated survey field — it is synthesized from the two
 * specific fear tags, since the spec lists "겁 많음" as its own row driving
 * route-familiarity (seed) behaviour distinct from what "자동차 무서워함"
 * and "사람 무서워함" individually drive.
 */
export type PersonalityFlags = {
  isAdventurous: boolean;
  isTimid: boolean;
  isCarFearful: boolean;
  isPeopleFearful: boolean;
  prefersDogEncounters: boolean;
  avoidsDogs: boolean;
  prefersParks: boolean;
};

export function derivePersonalityFlags(
  socialPreference: DogSocialPreference,
  personalityTags: readonly DogPersonalityTag[]
): PersonalityFlags {
  const isCarFearful = personalityTags.includes("afraid_of_cars");
  const isPeopleFearful = personalityTags.includes("afraid_of_people");

  return {
    isAdventurous: personalityTags.includes("likes_new_routes"),
    isTimid: isCarFearful || isPeopleFearful,
    isCarFearful,
    isPeopleFearful,
    prefersDogEncounters: socialPreference === "likes_dogs",
    avoidsDogs: socialPreference === "avoids_dogs",
    prefersParks: personalityTags.includes("likes_parks")
  };
}

export type DogProfileInput = {
  dogId: string;
  breedId: string;
  /** `dog_breeds.group_name` for the dog's breed, or null if the breed
   * could not be resolved (e.g. free-text breed value with no match). */
  akcGroupName: string | null;
  weightKg: number;
  birthDateIso: string;
  socialPreference: DogSocialPreference;
  personalityTags: readonly DogPersonalityTag[];
  healthNotes: string | null;
  /** Defaults to DEFAULT_ACTIVITY_LEVEL until the personality survey adds
   * an activity-level question (spec 8, 미확정 항목). */
  activityLevel?: DogActivityLevel;
};

export type DogProfile = {
  dogId: string;
  breedId: string;
  weightKg: number;
  ageMonths: number;
  sizeClass: DogSizeClass;
  lifeStage: DogLifeStage;
  kcGrade: KcExerciseGrade;
  breedExerciseSource: string;
  isBrachycephalic: boolean;
  isDoubleCoat: boolean;
  isPuppyUnder3Months: boolean;
  activityLevel: DogActivityLevel;
  walkingSpeedKmh: number;
  personality: PersonalityFlags;
  hasStairRestrictingHealthCondition: boolean;
  /** True when the stair-avoidance rule (spec 3.2, 3.3) applies to this
   * dog: senior/geriatric, a stair-restricting health note, or a puppy
   * 3 months old or younger of large/giant build. Consumed by both the
   * custom-model builder (STEPS priority 0) and the hierarchical filter
   * (hard exclusion). */
  needsStairFilter: boolean;
  seniorOnsetAgeYears: number;
};

export function normalizeDogProfile(input: DogProfileInput, now: Date = new Date()): DogProfile {
  const sizeClass = resolveSizeClassFromWeight(input.weightKg);
  const ageMonths = calculateAgeInMonths(input.birthDateIso, now);
  const lifeStage = resolveLifeStage(ageMonths, sizeClass);
  const walkingSpeedKmh = resolveWalkingSpeedKmh(input.weightKg, lifeStage);
  const seniorOnsetAgeYears = SENIOR_ONSET_AGE_YEARS_BY_SIZE_CLASS[sizeClass];

  const breedExercise = resolveBreedExerciseProfile(input.breedId, input.akcGroupName);

  const hasStairRestrictingHealthCondition = detectsStairRestrictingHealthCondition(
    input.healthNotes
  );

  const isPuppyUnder3Months = ageMonths <= 3;

  // "3개월 이하 대형견 퍼피" (spec 3.2/3.3, Krontveit 2012) is about the
  // breed's ADULT size, not the puppy's current weight — a 2-month-old
  // large-breed puppy still weighs little, so the weight-derived
  // `sizeClass` above would misclassify it as small/medium. Use the
  // breed's reference size class when known; fall back to the puppy's
  // current weight-derived size only for unrecognized breeds, since no
  // better signal is available there.
  const puppyReferenceSizeClass = breedExercise.referenceSizeClass ?? sizeClass;
  const isLargeOrGiantBreed =
    puppyReferenceSizeClass === "large" || puppyReferenceSizeClass === "giant";

  const isSenior = lifeStage === "senior" || lifeStage === "geriatric";

  const needsStairFilter =
    isSenior ||
    hasStairRestrictingHealthCondition ||
    (isPuppyUnder3Months && isLargeOrGiantBreed);

  return {
    dogId: input.dogId,
    breedId: input.breedId,
    weightKg: input.weightKg,
    ageMonths,
    sizeClass,
    lifeStage,
    kcGrade: breedExercise.kcGrade,
    breedExerciseSource: breedExercise.source,
    isBrachycephalic: breedExercise.isBrachycephalic,
    isDoubleCoat: breedExercise.isDoubleCoat,
    isPuppyUnder3Months,
    activityLevel: input.activityLevel ?? DEFAULT_ACTIVITY_LEVEL,
    walkingSpeedKmh,
    personality: derivePersonalityFlags(input.socialPreference, input.personalityTags),
    hasStairRestrictingHealthCondition,
    needsStairFilter,
    seniorOnsetAgeYears
  };
}
