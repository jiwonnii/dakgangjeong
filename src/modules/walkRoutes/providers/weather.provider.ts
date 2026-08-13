/**
 * 기상청 단기예보 조회서비스 (getVilageFcst) client, producing the
 * WeatherSnapshot warning-check.ts consumes.
 *
 * Design note on 체감온도 (spec 4.1 row 13, "기상청 생활기상지수 3.0"):
 * rather than call that second, separate API — whose exact query
 * parameters (지역코드 vs 격자 vs 위경도) were not verified anywhere in
 * this project's research — apparent temperature is computed directly
 * from getVilageFcst's own 기온(TMP)/습도(REH)/풍속(WSD) fields using
 * KMA's own published formulas:
 *   - Summer heat index: KMA's Steadman-derived formula over wet-bulb
 *     temperature, wet-bulb approximated via Stull (2011)'s well-known
 *     closed-form fit.
 *   - Winter wind chill: the standard NWS/Environment Canada formula KMA
 *     also publishes.
 * This keeps the whole warning pipeline dependent on a single, verified
 * endpoint instead of two, one of which was never confirmed against a live
 * response. If 생활기상지수 체감온도 is later preferred (e.g. because it
 * factors in solar radiation, which this calculation does not), swap the
 * implementation of `getApparentTemperatureC` below — everything else in
 * this file is unaffected.
 */

import { AppError } from "../../../lib/app-error";
import { convertToKmaGrid } from "../../../lib/kma-grid";
import { TtlCache } from "../../../lib/ttl-cache";
import { getKstParts } from "../../../lib/kst-time";
import { env } from "../../../config/env";
import { WEATHER_CACHE_TTL_SECONDS } from "../../../constants/walk-tuning";
import type { PrecipitationType, WeatherSnapshot } from "../domain/warning-check";

const KMA_VILAGE_FCST_ENDPOINT =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

const PUBLISH_HOURS_KST = [2, 5, 8, 11, 14, 17, 20, 23];
const PUBLISH_READY_DELAY_MINUTES = 10;

const SNOW_DAY_TRACKER_TTL_SECONDS = 7 * 24 * 60 * 60;

type KmaVilageFcstItem = {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
};

type KmaVilageFcstResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item: KmaVilageFcstItem[] };
    };
  };
};

const forecastSnapshotCache = new TtlCache<string, WeatherSnapshot>(WEATHER_CACHE_TTL_SECONDS);
const lastSnowDateByGrid = new TtlCache<string, string>(SNOW_DAY_TRACKER_TTL_SECONDS);

function requirePublicDataApiKey(): string {
  if (!env.PUBLIC_DATA_API_KEY) {
    throw new AppError(
      "PUBLIC_DATA_API_KEY is not configured.",
      500,
      "PUBLIC_DATA_API_KEY_MISSING"
    );
  }

  return env.PUBLIC_DATA_API_KEY;
}

function formatYyyyMmDd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/**
 * Resolves the most recent KMA base_date/base_time that is guaranteed to
 * already be published, accounting for the ~10 minute publish delay after
 * each of the 8 daily forecast runs (02/05/08/11/14/17/20/23시 KST).
 */
export function resolveBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const kst = getKstParts(now);

  const readyHours = PUBLISH_HOURS_KST.filter(
    (hour) => hour < kst.hour || (hour === kst.hour && kst.minute >= PUBLISH_READY_DELAY_MINUTES)
  );

  if (readyHours.length > 0) {
    const baseHour = Math.max(...readyHours);
    return {
      baseDate: formatYyyyMmDd(kst.year, kst.month, kst.day),
      baseTime: `${String(baseHour).padStart(2, "0")}00`
    };
  }

  // Before today's 02:00(+delay) run is ready — fall back to yesterday's
  // last run (23:00).
  const previousDay = new Date(Date.UTC(kst.year, kst.month - 1, kst.day));
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);

  return {
    baseDate: formatYyyyMmDd(
      previousDay.getUTCFullYear(),
      previousDay.getUTCMonth() + 1,
      previousDay.getUTCDate()
    ),
    baseTime: `${String(PUBLISH_HOURS_KST[PUBLISH_HOURS_KST.length - 1]).padStart(2, "0")}00`
  };
}

/** Stull (2011) closed-form wet-bulb temperature approximation, valid for
 * relative humidity 5~99% and temperature -20~50°C — comfortably covers
 * Korean seasonal conditions. */
function calculateWetBulbTemperatureC(tempC: number, relativeHumidityPercent: number): number {
  const rh = relativeHumidityPercent;

  return (
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/**
 * 체감온도 (apparent temperature), °C. Summer heat-index formula above
 * 27°C, winter wind-chill below 10°C with sufficient wind, otherwise the
 * actual air temperature (the difference is negligible in mild weather).
 */
export function getApparentTemperatureC(
  tempC: number,
  relativeHumidityPercent: number,
  windSpeedMs: number
): number {
  if (tempC >= 27) {
    const wetBulbC = calculateWetBulbTemperatureC(tempC, relativeHumidityPercent);
    const heatIndex =
      -0.2442 +
      0.55399 * wetBulbC +
      0.45535 * tempC -
      0.0022 * wetBulbC * wetBulbC +
      0.00278 * wetBulbC * tempC +
      3.0;

    return Math.round(heatIndex * 10) / 10;
  }

  const windKmh = windSpeedMs * 3.6;

  if (tempC <= 10 && windKmh >= 4.8) {
    const windChill =
      13.12 +
      0.6215 * tempC -
      11.37 * Math.pow(windKmh, 0.16) +
      0.3965 * tempC * Math.pow(windKmh, 0.16);

    return Math.round(windChill * 10) / 10;
  }

  return Math.round(tempC * 10) / 10;
}

/** PTY 강수형태 코드 → PrecipitationType (getVilageFcst code table:
 * 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기, 5=빗방울, 6=빗방울눈날림, 7=눈날림). */
function mapPrecipitationType(ptyCode: string): PrecipitationType {
  switch (ptyCode) {
    case "0":
      return "none";
    case "2":
    case "3":
    case "6":
    case "7":
      return "snow";
    default:
      return "rain";
  }
}

/** Parses a PCP/SNO categorical string (e.g. "30.0~50.0mm", "50.0mm 이상",
 * "강수없음", "적설없음") into its lower-bound numeric value. Both fields
 * share this category format in getVilageFcst's documented response. */
function parsePrecipitationCategoryLowerBound(category: string): number {
  if (category.includes("없음")) {
    return 0;
  }

  const match = category.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

const HEAVY_RAIN_THRESHOLD_MM = 30;
const HEAVY_SNOW_THRESHOLD_CM = 5;

function findNearestForecastSlot(
  items: KmaVilageFcstItem[],
  now: Date
): { fcstDate: string; fcstTime: string; values: Map<string, string> } | null {
  const slotKeys = new Set(items.map((item) => `${item.fcstDate}:${item.fcstTime}`));

  let nearestKey: string | null = null;
  let nearestDiffMs = Number.POSITIVE_INFINITY;

  for (const key of slotKeys) {
    const [fcstDate, fcstTime] = key.split(":");
    const year = Number(fcstDate.slice(0, 4));
    const month = Number(fcstDate.slice(4, 6));
    const day = Number(fcstDate.slice(6, 8));
    const hour = Number(fcstTime.slice(0, 2));
    const minute = Number(fcstTime.slice(2, 4));

    // KST wall-clock time expressed as a UTC instant by subtracting the
    // 9-hour offset, since Korea has no DST.
    const slotInstant = Date.UTC(year, month - 1, day, hour - 9, minute);
    const diff = Math.abs(slotInstant - now.getTime());

    if (diff < nearestDiffMs) {
      nearestDiffMs = diff;
      nearestKey = key;
    }
  }

  if (!nearestKey) {
    return null;
  }

  const [fcstDate, fcstTime] = nearestKey.split(":");
  const values = new Map<string, string>();

  for (const item of items) {
    if (item.fcstDate === fcstDate && item.fcstTime === fcstTime) {
      values.set(item.category, item.fcstValue);
    }
  }

  return { fcstDate, fcstTime, values };
}

async function fetchVilageFcst(nx: number, ny: number, now: Date): Promise<KmaVilageFcstItem[]> {
  const apiKey = requirePublicDataApiKey();
  const { baseDate, baseTime } = resolveBaseDateTime(now);

  const url = new URL(KMA_VILAGE_FCST_ENDPOINT);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", String(nx));
  url.searchParams.set("ny", String(ny));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new AppError(
      `KMA getVilageFcst request failed with status ${response.status}.`,
      502,
      "KMA_REQUEST_FAILED"
    );
  }

  const payload = (await response.json()) as KmaVilageFcstResponse;

  if (payload.response.header.resultCode !== "00") {
    throw new AppError(
      `KMA getVilageFcst returned an error: ${payload.response.header.resultMsg}`,
      502,
      "KMA_API_ERROR",
      payload.response.header
    );
  }

  return payload.response.body?.items?.item ?? [];
}

function trackSnowObservation(gridKey: string, precipitationType: PrecipitationType, now: Date): void {
  if (precipitationType !== "snow") {
    return;
  }

  const kst = getKstParts(now);
  lastSnowDateByGrid.set(gridKey, formatYyyyMmDd(kst.year, kst.month, kst.day));
}

function calculateDaysSinceLastSnowfall(gridKey: string, now: Date): number | null {
  const lastSnowDate = lastSnowDateByGrid.get(gridKey);

  if (!lastSnowDate) {
    return null;
  }

  const year = Number(lastSnowDate.slice(0, 4));
  const month = Number(lastSnowDate.slice(4, 6));
  const day = Number(lastSnowDate.slice(6, 8));
  const lastSnowInstantMs = Date.UTC(year, month - 1, day);

  const kst = getKstParts(now);
  const todayInstantMs = Date.UTC(kst.year, kst.month - 1, kst.day);

  return Math.round((todayInstantMs - lastSnowInstantMs) / (24 * 60 * 60 * 1000));
}

/**
 * Fetches and assembles the WeatherSnapshot for a point, caching the raw
 * forecast lookup per grid cell for WEATHER_CACHE_TTL_SECONDS.
 *
 * `daysSinceLastSnowfall` is tracked in-memory as a side effect of each
 * call (see trackSnowObservation) rather than sourced from a historical
 * weather API, since spec 4.1 does not list one. This means the value is
 * `null` (unknown, not "no recent snow") until this process has observed a
 * snow forecast for the grid cell at least once since its last restart —
 * an accepted limitation for an MVP-scope contextual banner, not a
 * safety-critical figure.
 */
export async function getWeatherSnapshot(lat: number, lon: number): Promise<WeatherSnapshot> {
  const { nx, ny } = convertToKmaGrid(lat, lon);
  const gridKey = `${nx}:${ny}`;
  const now = new Date();

  const snapshot = await forecastSnapshotCache.getOrCompute(gridKey, async () => {
    const items = await fetchVilageFcst(nx, ny, now);
    const slot = findNearestForecastSlot(items, now);

    if (!slot) {
      throw new AppError(
        "KMA getVilageFcst returned no forecast items for this grid cell.",
        502,
        "KMA_EMPTY_FORECAST"
      );
    }

    const tempC = Number(slot.values.get("TMP") ?? "NaN");
    const humidityPercent = Number(slot.values.get("REH") ?? "NaN");
    const windSpeedMs = Number(slot.values.get("WSD") ?? "NaN");
    const ptyCode = slot.values.get("PTY") ?? "0";
    const pcpCategory = slot.values.get("PCP") ?? "강수없음";
    const snoCategory = slot.values.get("SNO") ?? "적설없음";

    if (!Number.isFinite(tempC) || !Number.isFinite(humidityPercent) || !Number.isFinite(windSpeedMs)) {
      throw new AppError(
        "KMA getVilageFcst response is missing required fields (TMP/REH/WSD).",
        502,
        "KMA_INCOMPLETE_FORECAST"
      );
    }

    const precipitationType = mapPrecipitationType(ptyCode);
    const rainAmountMm = parsePrecipitationCategoryLowerBound(pcpCategory);
    const snowAmountCm = parsePrecipitationCategoryLowerBound(snoCategory);

    const isHeavyPrecipitation =
      rainAmountMm >= HEAVY_RAIN_THRESHOLD_MM || snowAmountCm >= HEAVY_SNOW_THRESHOLD_CM;

    trackSnowObservation(gridKey, precipitationType, now);

    return {
      pm10: Number.NaN, // filled in by air-quality.provider.ts; see recommendation.service.ts
      pm25: Number.NaN,
      apparentTemperatureC: getApparentTemperatureC(tempC, humidityPercent, windSpeedMs),
      precipitationType,
      isHeavyPrecipitation,
      daysSinceLastSnowfall: calculateDaysSinceLastSnowfall(gridKey, now)
    } satisfies WeatherSnapshot;
  });

  // daysSinceLastSnowfall must reflect "now", not the cached snapshot's
  // computation time, so it is recomputed on every call even on a cache
  // hit (cheap in-memory lookup, not worth its own cache entry).
  return {
    ...snapshot,
    daysSinceLastSnowfall: calculateDaysSinceLastSnowfall(gridKey, now)
  };
}
