/**
 * Ingests `benches` from OpenStreetMap (`amenity=bench` nodes) via the
 * Overpass API — spec 4.1 #1, and the one external source in this whole
 * project actually exercised successfully multiple times during this
 * session's own research (unlike every data.go.kr endpoint in the other
 * ingest-*.ts scripts). No API key required.
 *
 * Queries the same two service-area circles bearing-grid's precompute
 * batch (round 5) uses, via a single Overpass `around` query per circle —
 * Overpass accepts a plain radius+center, so no manual grid enumeration is
 * needed the way round 5's PostGIS-side batching required.
 *
 * Run with: npm run ingest:benches
 */

import { AppError } from "../../src/lib/app-error.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";
import {
  MYONGJI_CAMPUS_CENTER,
  MYONGJI_SERVICE_RADIUS_M,
  SEOUL_CITY_HALL_CENTER,
  SEOUL_COARSE_RADIUS_M
} from "../../src/constants/walk-tuning.js";

const SOURCE = "osm_overpass";
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const REQUEST_TIMEOUT_S = 90;

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
};

type OverpassResponse = {
  elements: OverpassNode[];
};

function buildBenchQuery(center: { lat: number; lon: number }, radiusM: number): string {
  return `[out:json][timeout:${REQUEST_TIMEOUT_S}];node(around:${radiusM},${center.lat},${center.lon})[amenity=bench];out;`;
}

async function fetchBenchNodes(center: { lat: number; lon: number }, radiusM: number): Promise<OverpassNode[]> {
  const query = buildBenchQuery(center, radiusM);

  // Overpass's shared public instances reject requests with no identifying
  // User-Agent — confirmed 2026-08-10: without it, overpass-api.de returned
  // a blanket 406 (not even a query-engine error) and the kumi.systems
  // mirror returned 429 with an explicit "include a meaningful User-Agent"
  // message. Adding one turned both into normal 504s (server busy, a real
  // but separate problem — retry later).
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "meoksa-be/0.1 (dog-walk recommendation app; ingest script)"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    throw new AppError(
      `Overpass request failed with status ${response.status}.`,
      502,
      "OVERPASS_REQUEST_FAILED"
    );
  }

  const payload = (await response.json()) as OverpassResponse;
  return payload.elements.filter((element) => element.type === "node");
}

async function main(): Promise<void> {
  console.log("[ingest-benches] Fetching bench nodes for Seoul + Yongin service area from Overpass...");

  const [seoulNodes, yonginNodes] = await Promise.all([
    fetchBenchNodes(SEOUL_CITY_HALL_CENTER, SEOUL_COARSE_RADIUS_M),
    fetchBenchNodes(MYONGJI_CAMPUS_CENTER, MYONGJI_SERVICE_RADIUS_M)
  ]);

  console.log(
    `[ingest-benches] Fetched ${seoulNodes.length} (Seoul) + ${yonginNodes.length} (Yongin) nodes.`
  );

  const seenIds = new Set<number>();
  const rows = [];

  for (const node of [...seoulNodes, ...yonginNodes]) {
    if (seenIds.has(node.id)) {
      continue; // the two circles can overlap at their edges
    }

    seenIds.add(node.id);

    rows.push({
      external_id: String(node.id),
      source: SOURCE,
      point: toEwktPoint(node.lon, node.lat)
    });
  }

  console.log(`[ingest-benches] ${rows.length} deduplicated rows to insert.`);

  await clearBySource("benches", "source", SOURCE);
  const inserted = await insertInBatches("benches", rows);

  console.log(`[ingest-benches] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-benches] Failed:", error);
  process.exitCode = 1;
});
