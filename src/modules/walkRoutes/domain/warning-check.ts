/**
 * Warning check (spec 5.1). Pure function: takes a `DogProfile` and a
 * `WeatherSnapshot` already assembled by weather.provider.ts /
 * air-quality.provider.ts, and returns the banner-level warning result plus
 * a duration penalty ratio that target-duration.ts applies.
 */

import type { WarningLevel, WarningType } from "../../../types/domain";
import { getKstHour } from "../../../lib/kst-time";
import {
  BRACHYCEPHALIC_HEAT_OFFSET_C,
  COLD_CAUTION_MAX_C,
  COLD_DANGER_MAX_C,
  DOUBLE_COAT_HEAT_OFFSET_C,
  HEAT_CAUTION_MIN_C,
  HEAT_DANGER_MIN_C,
  PM10_CAUTION_MIN,
  PM10_DANGER_MIN,
  PM25_CAUTION_MIN,
  PM25_DANGER_MIN,
  PUPPY_OR_SENIOR_COLD_OFFSET_C,
  PUPPY_OR_SENIOR_HEAT_OFFSET_C,
  SMALL_BREED_COLD_OFFSET_C,
  SMALL_BREED_COLD_OFFSET_MAX_WEIGHT_KG,
  SUMMER_DAYTIME_END_HOUR,
  SUMMER_DAYTIME_HEAT_THRESHOLD_C,
  SUMMER_DAYTIME_START_HOUR,
  WINTER_DEICER_WARNING_DAYS
} from "../../../constants/walk-tuning";
import type { DogProfile } from "./dog-profile";

export type PrecipitationType = "none" | "rain" | "snow";

export type WeatherSnapshot = {
  /** PM10, µg/m³. */
  pm10: number;
  /** PM2.5, µg/m³. */
  pm25: number;
  /** 체감온도, °C — computed from raw forecast fields by weather.provider.ts. */
  apparentTemperatureC: number;
  precipitationType: PrecipitationType;
  /** True when the current forecast/observation indicates a 호우 or 대설
   * warning-level precipitation amount (spec 5.1 위험 강수 기준). */
  isHeavyPrecipitation: boolean;
  /** Days since the most recent snowfall was observed, or null if unknown
   * (e.g. no observation history yet — see weather.provider.ts's caveat on
   * this field). */
  daysSinceLastSnowfall: number | null;
};

export type WarningEntry = {
  type: WarningType;
  level: Exclude<WarningLevel, "normal">;
  message: string;
  detail?: string;
};

export type WarningEvaluation = {
  overallLevel: WarningLevel;
  warnings: WarningEntry[];
  /** Multiplier target-duration.ts applies on top of the dog-intrinsic
   * duration (1 when overallLevel is "normal"). */
  durationPenaltyRatio: number;
};

const WARNING_LEVEL_SEVERITY: Record<WarningLevel, number> = {
  normal: 0,
  caution: 1,
  danger: 2
};

function moreSevere(a: WarningLevel, b: WarningLevel): WarningLevel {
  return WARNING_LEVEL_SEVERITY[a] >= WARNING_LEVEL_SEVERITY[b] ? a : b;
}

/**
 * Sum of the 견종·나이별 heat threshold offsets applicable to this dog
 * (spec 5.1). The spec lists each adjustment independently; where a dog
 * matches more than one (e.g. a senior brachycephalic dog), this
 * implementation sums the offsets rather than taking only the single most
 * extreme one — a deliberate, more conservative interpretation, since each
 * offset represents an independent physiological reason for added caution
 * and the spec does not state the offsets are mutually exclusive.
 */
function calculateHeatOffsetC(profile: DogProfile): number {
  let offset = 0;

  if (profile.isBrachycephalic) {
    offset += BRACHYCEPHALIC_HEAT_OFFSET_C;
  }

  if (profile.isDoubleCoat) {
    offset += DOUBLE_COAT_HEAT_OFFSET_C;
  }

  if (profile.lifeStage === "puppy" || profile.lifeStage === "senior" || profile.lifeStage === "geriatric") {
    offset += PUPPY_OR_SENIOR_HEAT_OFFSET_C;
  }

  return offset;
}

function calculateColdOffsetC(profile: DogProfile): number {
  let offset = 0;

  if (profile.weightKg < SMALL_BREED_COLD_OFFSET_MAX_WEIGHT_KG) {
    offset += SMALL_BREED_COLD_OFFSET_C;
  }

  if (profile.lifeStage === "puppy" || profile.lifeStage === "senior" || profile.lifeStage === "geriatric") {
    offset += PUPPY_OR_SENIOR_COLD_OFFSET_C;
  }

  return offset;
}

function evaluatePm10(pm10: number): WarningEntry | null {
  if (pm10 >= PM10_DANGER_MIN) {
    return {
      type: "pm10",
      level: "danger",
      message: "미세먼지가 매우 나빠요. 오늘은 산책을 짧게 하거나 미루는 게 좋아요.",
      detail: `PM10 ${pm10}µg/m³`
    };
  }

  if (pm10 >= PM10_CAUTION_MIN) {
    return {
      type: "pm10",
      level: "caution",
      message: "미세먼지가 나쁜 편이에요. 오래 걷는 건 피해주세요.",
      detail: `PM10 ${pm10}µg/m³`
    };
  }

  return null;
}

function evaluatePm25(pm25: number): WarningEntry | null {
  if (pm25 >= PM25_DANGER_MIN) {
    return {
      type: "pm25",
      level: "danger",
      message: "초미세먼지가 매우 나빠요. 오늘은 산책을 짧게 하거나 미루는 게 좋아요.",
      detail: `PM2.5 ${pm25}µg/m³`
    };
  }

  if (pm25 >= PM25_CAUTION_MIN) {
    return {
      type: "pm25",
      level: "caution",
      message: "초미세먼지가 나쁜 편이에요. 오래 걷는 건 피해주세요.",
      detail: `PM2.5 ${pm25}µg/m³`
    };
  }

  return null;
}

function evaluateHeat(apparentTemperatureC: number, profile: DogProfile): WarningEntry | null {
  const offset = calculateHeatOffsetC(profile);
  const effectiveDangerMin = HEAT_DANGER_MIN_C + offset;
  const effectiveCautionMin = HEAT_CAUTION_MIN_C + offset;

  const reasonParts: string[] = [];
  if (profile.isBrachycephalic) reasonParts.push("단두종");
  if (profile.isDoubleCoat) reasonParts.push("이중모");
  if (profile.lifeStage === "puppy") reasonParts.push("퍼피");
  if (profile.lifeStage === "senior" || profile.lifeStage === "geriatric") reasonParts.push("노령견");
  const reasonSuffix = reasonParts.length > 0 ? ` (${reasonParts.join("·")} 기준 강화)` : "";

  if (apparentTemperatureC >= effectiveDangerMin) {
    return {
      type: "heat",
      level: "danger",
      message: `체감온도가 많이 높아요. 산책을 미루는 걸 권해요.${reasonSuffix}`,
      detail: `체감 ${apparentTemperatureC}°C, 위험 기준 ${effectiveDangerMin}°C`
    };
  }

  if (apparentTemperatureC >= effectiveCautionMin) {
    return {
      type: "heat",
      level: "caution",
      message: `더워요. 짧게, 그늘 위주로 다녀오세요.${reasonSuffix}`,
      detail: `체감 ${apparentTemperatureC}°C, 주의 기준 ${effectiveCautionMin}°C`
    };
  }

  return null;
}

function evaluateCold(apparentTemperatureC: number, profile: DogProfile): WarningEntry | null {
  const offset = calculateColdOffsetC(profile);
  const effectiveDangerMax = COLD_DANGER_MAX_C + offset;
  const effectiveCautionMax = COLD_CAUTION_MAX_C + offset;

  const reasonParts: string[] = [];
  if (profile.weightKg < SMALL_BREED_COLD_OFFSET_MAX_WEIGHT_KG) reasonParts.push("소형견");
  if (profile.lifeStage === "puppy") reasonParts.push("퍼피");
  if (profile.lifeStage === "senior" || profile.lifeStage === "geriatric") reasonParts.push("노령견");
  const reasonSuffix = reasonParts.length > 0 ? ` (${reasonParts.join("·")} 기준 강화)` : "";

  if (apparentTemperatureC <= effectiveDangerMax) {
    return {
      type: "cold",
      level: "danger",
      message: `너무 추워요. 오늘은 산책을 미루는 걸 권해요.${reasonSuffix}`,
      detail: `체감 ${apparentTemperatureC}°C, 위험 기준 ${effectiveDangerMax}°C`
    };
  }

  if (apparentTemperatureC <= effectiveCautionMax) {
    return {
      type: "cold",
      level: "caution",
      message: `추워요. 짧게 다녀오고 발 보호를 신경 써주세요.${reasonSuffix}`,
      detail: `체감 ${apparentTemperatureC}°C, 주의 기준 ${effectiveCautionMax}°C`
    };
  }

  return null;
}

function evaluatePrecipitation(weather: WeatherSnapshot): WarningEntry | null {
  if (weather.isHeavyPrecipitation) {
    return {
      type: "precipitation",
      level: "danger",
      message: "호우·대설 특보 수준이에요. 오늘 산책은 피해주세요."
    };
  }

  if (weather.precipitationType !== "none") {
    const label = weather.precipitationType === "snow" ? "눈" : "비";
    return {
      type: "precipitation",
      level: "caution",
      message: `${label} 소식이 있어요. 우산이나 방수 용품을 챙기세요.`
    };
  }

  return null;
}

/**
 * 여름 주간 처리 (spec 5.1): a separate rule from `evaluateHeat` above,
 * using the fixed (non-per-dog-adjusted) threshold, because its output is
 * not "shorten the walk" but "walk later today instead" — a distinct
 * recommendation that applies the same way regardless of breed.
 */
function evaluateSummerDaytimeHeat(
  apparentTemperatureC: number,
  currentHour: number
): WarningEntry | null {
  const isDaytimeWindow =
    currentHour >= SUMMER_DAYTIME_START_HOUR && currentHour <= SUMMER_DAYTIME_END_HOUR;

  if (apparentTemperatureC >= SUMMER_DAYTIME_HEAT_THRESHOLD_C && isDaytimeWindow) {
    return {
      type: "summer_daytime_heat",
      level: "caution",
      message: "지금은 아스팔트가 뜨거울 시간이에요. 저녁 7시 이후를 권해요.",
      detail: "손등을 5초 대보고 뜨거우면 반려견 발바닥에도 뜨거워요."
    };
  }

  return null;
}

function evaluateWinterDeicer(daysSinceLastSnowfall: number | null): WarningEntry | null {
  if (daysSinceLastSnowfall !== null && daysSinceLastSnowfall <= WINTER_DEICER_WARNING_DAYS) {
    return {
      type: "winter_deicer",
      level: "caution",
      message: "최근 눈이 온 지역이라 제설제가 남아있을 수 있어요. 산책 후 발을 닦아주세요.",
      detail: `강설 후 ${daysSinceLastSnowfall}일 경과`
    };
  }

  return null;
}

/**
 * @param now Wall-clock time of the request, used only for the summer
 *   daytime hour check — deliberately independent of `weather`'s own
 *   forecast timestamp so a slightly stale cached forecast does not shift
 *   which hour-of-day rule applies.
 */
export function evaluateWarnings(
  profile: DogProfile,
  weather: WeatherSnapshot,
  now: Date
): WarningEvaluation {
  const entries = [
    evaluatePm10(weather.pm10),
    evaluatePm25(weather.pm25),
    evaluateHeat(weather.apparentTemperatureC, profile),
    evaluateCold(weather.apparentTemperatureC, profile),
    evaluatePrecipitation(weather),
    evaluateSummerDaytimeHeat(weather.apparentTemperatureC, getKstHour(now)),
    evaluateWinterDeicer(weather.daysSinceLastSnowfall)
  ].filter((entry): entry is WarningEntry => entry !== null);

  const overallLevel = entries.reduce<WarningLevel>(
    (level, entry) => moreSevere(level, entry.level),
    "normal"
  );

  return {
    overallLevel,
    warnings: entries,
    // 2026-08-10: 사용자 결정으로 날씨/미세먼지 경고는 배너 표시 전용으로
    // 바꿈 — 목표 시간을 실제로 줄이지 않는다. WARNING_DURATION_PENALTY_RATIO
    // 상수와 계산 자체는 남겨뒀으니(단순 no-op화), 나중에 다시 켜고 싶으면
    // 이 durationPenaltyRatio를 원래 값으로 되돌리기만 하면 됨.
    durationPenaltyRatio: 1
  };
}
