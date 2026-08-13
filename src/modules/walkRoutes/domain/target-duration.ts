/**
 * Target walk duration/distance calculation (spec 5.2). Pure function over
 * a `DogProfile` plus an optional warning-driven penalty ratio produced by
 * warning-check.ts (round 4) and threaded through by the orchestrating
 * service (round 10) — see spec 3.5: "미세먼지·악천후 | 경고·거리 | 배너
 * 표시 및 목표 시간 단축".
 */

import {
  ACTIVITY_LEVEL_DURATION_MULTIPLIER,
  AGE_STAGE_DURATION_MULTIPLIER,
  BASE_DURATION_MINUTES_BY_SIZE_CLASS,
  BRACHYCEPHALIC_DURATION_MULTIPLIER,
  KC_GRADE_DURATION_MULTIPLIER,
  MINIMUM_DURATION_FLOOR_MINUTES,
  MINIMUM_DURATION_RATIO
} from "../../../constants/walk-tuning";
import type { DogProfile } from "./dog-profile";

export type AppliedDurationFactor = {
  factor:
    | "base_size_class"
    | "kc_grade"
    | "age_stage"
    | "brachycephalic"
    | "activity_level"
    | "warning_penalty";
  label: string;
  multiplier: number;
};

export type DurationOptions = {
  minimumMinutes: number;
  recommendedMinutes: number;
  maximumMinutes: number;
  minimumMeters: number;
  recommendedMeters: number;
  maximumMeters: number;
  walkingSpeedKmh: number;
  appliedFactors: AppliedDurationFactor[];
};

const LIFE_STAGE_LABEL_KO: Record<DogProfile["lifeStage"], string> = {
  puppy: "퍼피",
  young_adult: "어린 성견 (1~3세)",
  adult: "성견 (4세 이상, 노령 전)",
  senior: "노령견",
  geriatric: "초고령견"
};

const KC_GRADE_LABEL_KO: Record<DogProfile["kcGrade"], string> = {
  up_to_30_min: "KC 등급: 최대 30분",
  up_to_1_hour: "KC 등급: 최대 1시간",
  up_to_2_hours: "KC 등급: 최대 2시간",
  over_2_hours: "KC 등급: 2시간 이상"
};

const ACTIVITY_LEVEL_LABEL_KO: Record<DogProfile["activityLevel"], string> = {
  low: "활발함: 낮음",
  normal: "활발함: 보통",
  high: "활발함: 높음"
};

const MAXIMUM_CUSTOM_DURATION_MINUTES = 240;

function minutesToMeters(minutes: number, walkingSpeedKmh: number): number {
  return Math.round(minutes * (walkingSpeedKmh / 60) * 1000);
}

/**
 * Computes 최소/적정/상한 duration and distance for one dog, per spec 5.2's
 * exact multiplier chain, and returns the applied-factor breakdown used to
 * build the AI explanation later (spec 5.7 응답 예시의 `breakdown`/`facts`
 * pattern extends to duration reasoning too).
 *
 * @param warningDurationPenaltyRatio Multiplier from warning-check.ts
 *   (WARNING_DURATION_PENALTY_RATIO for the current level, or 1 when there
 *   is no active warning). Applied last, after all dog-intrinsic factors.
 */
export function calculateTargetDuration(
  profile: DogProfile,
  warningDurationPenaltyRatio = 1
): DurationOptions {
  if (!Number.isFinite(warningDurationPenaltyRatio) || warningDurationPenaltyRatio <= 0) {
    throw new Error(
      `Invalid warningDurationPenaltyRatio: ${warningDurationPenaltyRatio}`
    );
  }

  const baseMinutes = BASE_DURATION_MINUTES_BY_SIZE_CLASS[profile.sizeClass];
  const kcMultiplier = KC_GRADE_DURATION_MULTIPLIER[profile.kcGrade];
  const ageMultiplier = AGE_STAGE_DURATION_MULTIPLIER[profile.lifeStage];
  const brachyMultiplier = profile.isBrachycephalic ? BRACHYCEPHALIC_DURATION_MULTIPLIER : 1;
  const activityMultiplier = ACTIVITY_LEVEL_DURATION_MULTIPLIER[profile.activityLevel];

  const recommendedMinutesExact =
    baseMinutes *
    kcMultiplier *
    ageMultiplier *
    brachyMultiplier *
    activityMultiplier *
    warningDurationPenaltyRatio;

  const recommendedMinutes = Math.round(recommendedMinutesExact);

  const minimumMinutes = Math.max(
    MINIMUM_DURATION_FLOOR_MINUTES,
    Math.round(recommendedMinutesExact * MINIMUM_DURATION_RATIO)
  );

  const maximumMinutes = MAXIMUM_CUSTOM_DURATION_MINUTES;

  const appliedFactors: AppliedDurationFactor[] = [
    {
      factor: "base_size_class",
      label: `체급 기본값 (${profile.sizeClass}): ${baseMinutes}분`,
      multiplier: 1
    },
    {
      factor: "kc_grade",
      label: KC_GRADE_LABEL_KO[profile.kcGrade],
      multiplier: kcMultiplier
    },
    {
      factor: "age_stage",
      label: LIFE_STAGE_LABEL_KO[profile.lifeStage],
      multiplier: ageMultiplier
    }
  ];

  if (profile.isBrachycephalic) {
    appliedFactors.push({
      factor: "brachycephalic",
      label: "단두종 활동량 저하",
      multiplier: brachyMultiplier
    });
  }

  appliedFactors.push({
    factor: "activity_level",
    label: ACTIVITY_LEVEL_LABEL_KO[profile.activityLevel],
    multiplier: activityMultiplier
  });

  if (warningDurationPenaltyRatio !== 1) {
    appliedFactors.push({
      factor: "warning_penalty",
      label: "환경 경고로 인한 목표 시간 단축",
      multiplier: warningDurationPenaltyRatio
    });
  }

  return {
    minimumMinutes,
    recommendedMinutes,
    maximumMinutes,
    minimumMeters: minutesToMeters(minimumMinutes, profile.walkingSpeedKmh),
    recommendedMeters: minutesToMeters(recommendedMinutes, profile.walkingSpeedKmh),
    maximumMeters: minutesToMeters(maximumMinutes, profile.walkingSpeedKmh),
    walkingSpeedKmh: profile.walkingSpeedKmh,
    appliedFactors
  };
}
