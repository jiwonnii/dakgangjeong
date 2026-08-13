/**
 * TMAP(SK Open API) 보행자 경로안내 client — spec 4.2, "횡단보도
 * (facilityType 15), 계단(17), 육교(12), 지하보도(14) 자동 추출". Kept
 * entirely out of the synchronous recommendation pipeline (spec 7.3) —
 * see round-12's wiring in recommendation.service.ts, which calls this
 * fire-and-forget after the response is already sent.
 *
 * VERIFICATION NOTE: unlike the government "표준데이터" endpoints in
 * jobs/ingest/, the endpoint URL and `facilityType` code table used here
 * were actually researched and fetched from TMAP's own documentation
 * earlier in this project (not guessed) — see docs/external-apis.md's
 * "TMAP 보행자 경로 API로 횡단보도·계단을 자동으로 셀 수 있다" section.
 * The one genuinely unverified part is how to request a *round-trip loop*
 * through this API — TMAP's pedestrian routing is naturally an A→B
 * point-to-point call, and the passList waypoint-count limit was never
 * confirmed. See buildPassList's doc comment for the approach taken.
 */

import { AppError } from "../../../lib/app-error";
import { env } from "../../../config/env";
import type { LatLon } from "../../../lib/geo";
import { TMAP_FACILITY_TYPE, TMAP_MAX_PASS_LIST_POINTS } from "../../../constants/walk-tuning";

const TMAP_PEDESTRIAN_ROUTE_ENDPOINT = "https://apis.openapi.sk.com/tmap/routes/pedestrian";

export type TmapFacilityCounts = {
  crosswalkCount: number;
  stepsCount: number;
  overpassCount: number;
  underpassCount: number;
};

type TmapRouteFeature = {
  type: "Feature";
  geometry: { type: "Point" | "LineString"; coordinates: unknown };
  properties: {
    facilityType?: string | number;
    [key: string]: unknown;
  };
};

type TmapRouteResponse = {
  features?: TmapRouteFeature[];
  error?: { message?: string };
};

function requireTmapAppKey(): string {
  if (!env.TMAP_APP_KEY) {
    throw new AppError("TMAP_APP_KEY is not configured.", 500, "TMAP_APP_KEY_MISSING");
  }

  return env.TMAP_APP_KEY;
}

/**
 * Downsamples a round-trip path (which starts and ends at the same origin)
 * into TMAP's `passList` waypoint format: "lon,lat_lon,lat_...". Since our
 * candidate is a loop, `startX/Y` and `endX/Y` in the request both use the
 * path's own first point — the actual shape of the walk is carried
 * entirely by passList, which is why every interior point matters more
 * here than in a typical point-to-point TMAP request. Evenly samples down
 * to TMAP_MAX_PASS_LIST_POINTS interior points when the path is longer
 * than that, always keeping the first and last interior points to
 * preserve the overall loop shape as well as a fixed budget allows.
 */
function buildPassList(points: readonly LatLon[]): string {
  const interior = points.slice(1, -1);

  if (interior.length <= TMAP_MAX_PASS_LIST_POINTS) {
    return interior.map((p) => `${p.lon},${p.lat}`).join("_");
  }

  const step = (interior.length - 1) / (TMAP_MAX_PASS_LIST_POINTS - 1);
  const sampled: LatLon[] = [];

  for (let i = 0; i < TMAP_MAX_PASS_LIST_POINTS; i++) {
    sampled.push(interior[Math.round(i * step)]);
  }

  return sampled.map((p) => `${p.lon},${p.lat}`).join("_");
}

function countByFacilityType(features: TmapRouteFeature[], facilityType: number): number {
  return features.filter((feature) => Number(feature.properties.facilityType) === facilityType).length;
}

/**
 * Verifies one candidate's path against TMAP's real pedestrian routing
 * data, returning facility counts along the way. Throws on any failure —
 * callers running this in the fire-and-forget background pass (round 12
 * wiring) must catch and log rather than let a TMAP hiccup surface
 * anywhere near the user-facing request.
 */
export async function verifyPedestrianRoute(points: readonly LatLon[]): Promise<TmapFacilityCounts> {
  if (points.length < 2) {
    throw new AppError("A path needs at least 2 points to verify.", 400, "TMAP_PATH_TOO_SHORT");
  }

  const appKey = requireTmapAppKey();
  const start = points[0];
  const end = points[points.length - 1];

  const response = await fetch(TMAP_PEDESTRIAN_ROUTE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appKey
    },
    body: JSON.stringify({
      startX: String(start.lon),
      startY: String(start.lat),
      endX: String(end.lon),
      endY: String(end.lat),
      passList: buildPassList(points),
      startName: "출발",
      endName: "도착",
      searchOption: "0",
      resCoordType: "WGS84GEO",
      reqCoordType: "WGS84GEO"
    })
  });

  if (!response.ok) {
    throw new AppError(
      `TMAP pedestrian route request failed with status ${response.status}.`,
      502,
      "TMAP_REQUEST_FAILED"
    );
  }

  const payload = (await response.json()) as TmapRouteResponse;

  if (payload.error) {
    throw new AppError(
      `TMAP pedestrian route returned an error: ${payload.error.message ?? "unknown"}`,
      502,
      "TMAP_API_ERROR",
      payload.error
    );
  }

  const features = payload.features ?? [];

  return {
    crosswalkCount: countByFacilityType(features, TMAP_FACILITY_TYPE.CROSSWALK),
    stepsCount: countByFacilityType(features, TMAP_FACILITY_TYPE.STEPS),
    overpassCount: countByFacilityType(features, TMAP_FACILITY_TYPE.OVERPASS),
    underpassCount: countByFacilityType(features, TMAP_FACILITY_TYPE.UNDERPASS)
  };
}
