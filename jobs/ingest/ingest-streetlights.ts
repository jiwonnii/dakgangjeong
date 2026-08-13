/**
 * Ingests `streetlights` from 전국보안등정보표준데이터 (spec 4.1 #6).
 *
 * Switched 2026-08-10 from the local-file approach (the downloaded XLS's
 * 50,000-row UI export cap turned out to have zero Seoul coverage — see
 * memory) to the real OpenAPI, confirmed working after the user's 활용신청
 * was approved: `api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api`. This
 * one has no region filter param, so — same technique as
 * ingest-road-segments.ts's node-link SHP and ingest-street-trees.ts —
 * every page is fetched nationwide via `fetchAllGovDataItems`'s built-in
 * pagination and then filtered down to the Seoul+Yongin service area.
 * Field names are English camelCase (latitude/longitude/lmpLcNm/
 * installationCo), the same "tn_pubr_" envelope family as parks.
 *
 * This populates the standalone `streetlights` table (spec 6). `lit` itself
 * lives on `road_segments`, set separately by ingest-road-segments.ts's own
 * overlay pass, which calls `fetchStreetlightsInServiceArea` (exported
 * below) rather than re-fetching — one HTTP round trip serves both tables
 * instead of two independent full nationwide fetches.
 *
 * Run with: npm run ingest:streetlights
 */

import { fetchAllGovDataItems, readNumberField } from "./lib/gov-data-client.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";
import { isWithinRadiusMeters } from "../../src/lib/geo.js";
import {
  MYONGJI_CAMPUS_CENTER,
  MYONGJI_SERVICE_RADIUS_M,
  SEOUL_CITY_HALL_CENTER,
  SEOUL_COARSE_RADIUS_M
} from "../../src/constants/walk-tuning.js";

const SOURCE = "standard_data_security_lights";
const ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api"; // 전국보안등정보표준데이터

function isInServiceArea(point: { lat: number; lon: number }): boolean {
  return (
    isWithinRadiusMeters(SEOUL_CITY_HALL_CENTER, point, SEOUL_COARSE_RADIUS_M) ||
    isWithinRadiusMeters(MYONGJI_CAMPUS_CENTER, point, MYONGJI_SERVICE_RADIUS_M)
  );
}

export type ServiceAreaStreetlight = { lat: number; lon: number };

/** Fetches every 보안등 nationwide and returns only the ones inside this
 * project's service area — shared by this script's own `main()` and
 * ingest-road-segments.ts's `applyStreetlightOverlay`, so the (slow,
 * nationwide-paginated) fetch happens once per `npm run ingest:road-segments`
 * run instead of twice. */
export async function fetchStreetlightsInServiceArea(): Promise<ServiceAreaStreetlight[]> {
  const items = await fetchAllGovDataItems(ENDPOINT);
  console.log(`[streetlights] ${items.length} records fetched nationwide.`);

  const points: ServiceAreaStreetlight[] = [];

  for (const item of items) {
    const lat = readNumberField(item, "latitude", "위도", "lat");
    const lon = readNumberField(item, "longitude", "경도", "lon");

    if (lat === null || lon === null) {
      continue;
    }

    const point = { lat, lon };
    if (isInServiceArea(point)) {
      points.push(point);
    }
  }

  console.log(`[streetlights] ${points.length} within the Seoul+Yongin service area.`);
  return points;
}

async function main(): Promise<void> {
  console.log("[ingest-streetlights] Fetching 전국보안등정보표준데이터...");
  const points = await fetchStreetlightsInServiceArea();

  await clearBySource("streetlights", "source", SOURCE);

  const rows = points.map((point) => ({
    external_id: null,
    source: SOURCE,
    point: toEwktPoint(point.lon, point.lat),
    light_type: "security_light" as const
  }));

  console.log(`[ingest-streetlights] ${rows.length} rows to insert.`);

  const inserted = await insertInBatches("streetlights", rows);
  console.log(`[ingest-streetlights] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-streetlights] Failed:", error);
  process.exitCode = 1;
});
