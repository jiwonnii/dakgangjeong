/**
 * 에어코리아 대기오염정보 client: finds the nearest measuring station by
 * TM coordinate (spec 4.1 note 3), then reads its latest PM10/PM2.5
 * reading.
 */

import { AppError } from "../../../lib/app-error";
import { convertToTmCoordinate } from "../../../lib/tm-coord";
import { TtlCache } from "../../../lib/ttl-cache";
import { env } from "../../../config/env";
import { AIR_QUALITY_CACHE_TTL_SECONDS } from "../../../constants/walk-tuning";

const NEARBY_STATION_ENDPOINT =
  "http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList";
const REALTIME_MEASUREMENT_ENDPOINT =
  "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty";

export type AirQualitySnapshot = {
  pm10: number;
  pm25: number;
  stationName: string;
  /** True if either PM10 or PM2.5 came back unmeasured ("-") from the
   * station and was defaulted to 0 rather than treated as a real reading —
   * see the comment on parseAirQualityValue below for why 0, not an error,
   * is the safe default here. */
  hadMissingReading: boolean;
};

type NearbyStationResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: Array<{ stationName: string; tm?: string; addr?: string }>;
    };
  };
};

type RealtimeMeasurementResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: Array<{ pm10Value: string; pm25Value: string; dataTime: string }>;
    };
  };
};

const nearestStationCache = new TtlCache<string, string>(AIR_QUALITY_CACHE_TTL_SECONDS);
const measurementCache = new TtlCache<string, AirQualitySnapshot>(AIR_QUALITY_CACHE_TTL_SECONDS);

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

function roundToCoarseCacheKey(value: number): number {
  // Station lookups don't need to be more precise than ~1km: round the TM
  // coordinate (already in meters) to the nearest kilometer so nearby
  // requests within the same walk share a cache entry.
  return Math.round(value / 1000) * 1000;
}

async function findNearestStationName(lat: number, lon: number): Promise<string> {
  const { tmX, tmY } = convertToTmCoordinate(lat, lon);
  const cacheKey = `${roundToCoarseCacheKey(tmX)}:${roundToCoarseCacheKey(tmY)}`;

  return nearestStationCache.getOrCompute(cacheKey, async () => {
    const apiKey = requirePublicDataApiKey();
    const url = new URL(NEARBY_STATION_ENDPOINT);
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("returnType", "json");
    url.searchParams.set("tmX", String(tmX));
    url.searchParams.set("tmY", String(tmY));
    url.searchParams.set("ver", "1.1");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new AppError(
        `AirKorea getNearbyMsrstnList request failed with status ${response.status}.`,
        502,
        "AIRKOREA_REQUEST_FAILED"
      );
    }

    const payload = (await response.json()) as NearbyStationResponse;

    if (payload.response.header.resultCode !== "00") {
      throw new AppError(
        `AirKorea getNearbyMsrstnList returned an error: ${payload.response.header.resultMsg}`,
        502,
        "AIRKOREA_API_ERROR",
        payload.response.header
      );
    }

    const nearest = payload.response.body?.items?.[0];

    if (!nearest) {
      throw new AppError(
        "AirKorea getNearbyMsrstnList returned no nearby stations.",
        502,
        "AIRKOREA_NO_STATION"
      );
    }

    return nearest.stationName;
  });
}

/**
 * AirKorea reports "-" for a pollutant that a station is not currently
 * measuring (e.g. sensor maintenance). Treating that as 0 rather than
 * throwing keeps the warning pipeline available — a missing reading should
 * never itself produce a false "위험" warning, and 0 is the value that
 * cannot trigger PM10_CAUTION_MIN/PM25_CAUTION_MIN. The caller is told via
 * `hadMissingReading` so it can choose to be more conservative if desired.
 */
function parseAirQualityValue(raw: string | undefined): { value: number; wasMissing: boolean } {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? { value: parsed, wasMissing: false } : { value: 0, wasMissing: true };
}

async function fetchRealtimeMeasurement(stationName: string): Promise<AirQualitySnapshot> {
  return measurementCache.getOrCompute(stationName, async () => {
    const apiKey = requirePublicDataApiKey();
    const url = new URL(REALTIME_MEASUREMENT_ENDPOINT);
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("returnType", "json");
    url.searchParams.set("numOfRows", "1");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("stationName", stationName);
    url.searchParams.set("dataTerm", "DAILY");
    url.searchParams.set("ver", "1.3");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new AppError(
        `AirKorea getMsrstnAcctoRltmMesureDnsty request failed with status ${response.status}.`,
        502,
        "AIRKOREA_REQUEST_FAILED"
      );
    }

    const payload = (await response.json()) as RealtimeMeasurementResponse;

    if (payload.response.header.resultCode !== "00") {
      throw new AppError(
        `AirKorea getMsrstnAcctoRltmMesureDnsty returned an error: ${payload.response.header.resultMsg}`,
        502,
        "AIRKOREA_API_ERROR",
        payload.response.header
      );
    }

    const latest = payload.response.body?.items?.[0];

    if (!latest) {
      throw new AppError(
        `AirKorea getMsrstnAcctoRltmMesureDnsty returned no measurements for station ${stationName}.`,
        502,
        "AIRKOREA_NO_MEASUREMENT"
      );
    }

    const pm10 = parseAirQualityValue(latest.pm10Value);
    const pm25 = parseAirQualityValue(latest.pm25Value);

    return {
      pm10: pm10.value,
      pm25: pm25.value,
      stationName,
      hadMissingReading: pm10.wasMissing || pm25.wasMissing
    } satisfies AirQualitySnapshot;
  });
}

/** Fetches the current PM10/PM2.5 reading for the station nearest to a point. */
export async function getAirQualitySnapshot(lat: number, lon: number): Promise<AirQualitySnapshot> {
  const stationName = await findNearestStationName(lat, lon);
  return fetchRealtimeMeasurement(stationName);
}
