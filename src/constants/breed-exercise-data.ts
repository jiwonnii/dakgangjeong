/**
 * Breed-level exercise metadata backing `breed_exercise` (migration 0003)
 * and the seed data for the `npm run ingest:breed-exercise` job.
 *
 * Provenance, honestly labelled per entry:
 *   - "royal_kennel_club": the breed's exact "Exercise" value was read from
 *     the breed's page on royalkennelclub.com (maltese, pug, border-collie).
 *   - "akc_group_estimate": no per-breed KC page was checked. The value is a
 *     typical classification for the breed given its AKC group and known
 *     energy level, consistent with the spec's acknowledged gap (10절:
 *     "견종별 필요 운동량에 대해서는 학계에서도 명확한 기준이 확립되지
 *     않았음"). These are real, defensible values, not placeholders — but
 *     they are estimates and should be corrected as real KC pages are
 *     checked.
 *
 * `sizeClass` on each entry is informational only (typical adult build for
 * the breed). The runtime duration calculation in target-duration.ts always
 * derives DogSizeClass from the individual dog's `weight_kg`, never from
 * this table, per spec 5.2.
 *
 * `isBrachycephalic` and `isDoubleCoat` are set to `true` ONLY for the
 * breeds the spec explicitly names (3.2 and 5.1). Other breeds that are
 * arguably brachycephalic or double-coated in reality (e.g. chow-chow,
 * mastiff) are deliberately left `false` here — the spec's list is the
 * contract, not a starting point to extend.
 */

import type { DogSizeClass, KcExerciseGrade } from "../types/domain";

export type BreedExerciseSource = "royal_kennel_club" | "akc_group_estimate";

export type BreedExerciseOverride = {
  breedId: string;
  kcGrade: KcExerciseGrade;
  sizeClass: DogSizeClass;
  isBrachycephalic: boolean;
  isDoubleCoat: boolean;
  source: BreedExerciseSource;
};

/** 단두종 목록 (spec 3.2, exact list — do not extend). */
export const BRACHYCEPHALIC_BREED_IDS: readonly string[] = [
  "pug",
  "bulldog",
  "french-bulldog",
  "shih-tzu",
  "pekingese",
  "boston-terrier",
  "boxer"
];

/** 이중모 목록 (spec 5.1, exact list — do not extend). */
export const DOUBLE_COAT_BREED_IDS: readonly string[] = [
  "siberian-husky",
  "samoyed",
  "pomeranian"
];

/** breed_id → generated/dog-breeds.generated.ts id. Covers popular breeds
 * in the Korean market (spec 8 미확정 항목: "인기 30종 수동 입력, 나머지는
 * AKC 그룹 기본값" — this table covers 47). */
export const BREED_EXERCISE_OVERRIDES: readonly BreedExerciseOverride[] = [
  { breedId: "maltese", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: false, source: "royal_kennel_club" },
  { breedId: "pug", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: true, isDoubleCoat: false, source: "royal_kennel_club" },
  { breedId: "border-collie", kcGrade: "over_2_hours", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "royal_kennel_club" },

  { breedId: "golden-retriever", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "labrador-retriever", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "miniature-schnauzer", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "beagle", kcGrade: "up_to_2_hours", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "bichon-frise", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "shiba-inu", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "shih-tzu", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "yorkshire-terrier", kcGrade: "up_to_1_hour", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "chihuahua", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "cardigan-welsh-corgi", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "pembroke-welsh-corgi", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "pomeranian", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: true, source: "akc_group_estimate" },
  { breedId: "poodle", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "french-bulldog", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "great-dane", kcGrade: "up_to_2_hours", sizeClass: "giant", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "dachshund", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "mastiff", kcGrade: "up_to_1_hour", sizeClass: "giant", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "basset-hound", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "bulldog", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "bullmastiff", kcGrade: "up_to_1_hour", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "vizsla", kcGrade: "over_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "st-bernard", kcGrade: "up_to_1_hour", sizeClass: "giant", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "siberian-husky", kcGrade: "over_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: true, source: "akc_group_estimate" },
  { breedId: "west-highland-white-terrier", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "australian-shepherd", kcGrade: "over_2_hours", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "german-shepherd-dog", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "chow-chow", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "chesapeake-bay-retriever", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "samoyed", kcGrade: "up_to_2_hours", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: true, source: "akc_group_estimate" },
  { breedId: "doberman-pinscher", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "rottweiler", kcGrade: "up_to_1_hour", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "akita", kcGrade: "up_to_1_hour", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "german-shorthaired-pointer", kcGrade: "over_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "chinese-shar-pei", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "cavalier-king-charles-spaniel", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "cocker-spaniel", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "papillon", kcGrade: "up_to_1_hour", sizeClass: "toy", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "pekingese", kcGrade: "up_to_30_min", sizeClass: "toy", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "pointer", kcGrade: "over_2_hours", sizeClass: "large", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "whippet", kcGrade: "up_to_1_hour", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "belgian-malinois", kcGrade: "over_2_hours", sizeClass: "medium", isBrachycephalic: false, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "boxer", kcGrade: "up_to_2_hours", sizeClass: "large", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" },
  { breedId: "boston-terrier", kcGrade: "up_to_1_hour", sizeClass: "small", isBrachycephalic: true, isDoubleCoat: false, source: "akc_group_estimate" }
];

/** AKC 그룹명 → KC 등급 기본값. Keys match the exact `groupName` strings
 * present in src/generated/dog-breeds.generated.ts, including the two
 * dual-group strings and the "Other"/"Mixed" fallback groups. */
export const AKC_GROUP_DEFAULT_KC_GRADE: Readonly<Record<string, KcExerciseGrade>> = {
  "Herding Group": "over_2_hours",
  "Sporting Group": "up_to_2_hours",
  "Working Group": "up_to_2_hours",
  "Hound Group": "up_to_2_hours",
  "Terrier Group": "up_to_1_hour",
  "Toy Group": "up_to_1_hour",
  "Non-Sporting Group": "up_to_1_hour",
  "Toy Group, Non-Sporting Group": "up_to_1_hour",
  "Terrier Group, Toy Group": "up_to_1_hour",
  Other: "up_to_1_hour",
  Mixed: "up_to_1_hour"
};

/** Used when a breed has no override row and no recognised AKC group
 * (e.g. `dogs.breed` holds a free-text value that never matched
 * `dog_breeds`). */
export const FALLBACK_KC_GRADE: KcExerciseGrade = "up_to_1_hour";

const breedOverrideById = new Map<string, BreedExerciseOverride>(
  BREED_EXERCISE_OVERRIDES.map((entry) => [entry.breedId, entry])
);

export type ResolvedBreedExerciseProfile = {
  kcGrade: KcExerciseGrade;
  /** Informational only — see file-level doc comment. Null when no
   * override row exists for this breed. */
  referenceSizeClass: DogSizeClass | null;
  isBrachycephalic: boolean;
  isDoubleCoat: boolean;
  source: BreedExerciseSource | "akc_group_default" | "fallback_default";
};

/**
 * Resolve a breed's exercise profile: exact override row first, then the
 * AKC group default, then the hard fallback. `isBrachycephalic` and
 * `isDoubleCoat` are resolved independently from the spec's exact id lists
 * so they are correct even for a breed that has no override row (e.g. a
 * brachycephalic breed missing from BREED_EXERCISE_OVERRIDES would still be
 * flagged via BRACHYCEPHALIC_BREED_IDS).
 */
export function resolveBreedExerciseProfile(
  breedId: string | null,
  akcGroupName: string | null
): ResolvedBreedExerciseProfile {
  const isBrachycephalic = breedId !== null && BRACHYCEPHALIC_BREED_IDS.includes(breedId);
  const isDoubleCoat = breedId !== null && DOUBLE_COAT_BREED_IDS.includes(breedId);

  const override = breedId !== null ? breedOverrideById.get(breedId) : undefined;

  if (override) {
    return {
      kcGrade: override.kcGrade,
      referenceSizeClass: override.sizeClass,
      isBrachycephalic,
      isDoubleCoat,
      source: override.source
    };
  }

  const groupDefault =
    akcGroupName !== null ? AKC_GROUP_DEFAULT_KC_GRADE[akcGroupName] : undefined;

  if (groupDefault) {
    return {
      kcGrade: groupDefault,
      referenceSizeClass: null,
      isBrachycephalic,
      isDoubleCoat,
      source: "akc_group_default"
    };
  }

  return {
    kcGrade: FALLBACK_KC_GRADE,
    referenceSizeClass: null,
    isBrachycephalic,
    isDoubleCoat,
    source: "fallback_default"
  };
}
