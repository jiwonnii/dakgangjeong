/**
 * Ingests `street_trees` from 전국가로수길정보표준데이터 (spec 4.1 #5), read
 * from a locally downloaded file at `jobs/ingest/data/street-trees.csv/xlsx/xls`
 * — download the dataset from data.go.kr and save it there before running.
 * Run with: npm run ingest:street-trees
 *
 * REAL FIELD SHAPE (verified against an actual downloaded file, 2026-08-10)
 * differs from what this project originally assumed: each row is a 가로수길
 * (tree-lined street corridor) — a LINE from 가로수길시작위도/경도 to
 * 가로수길종료위도/경도 — with an aggregate 가로수수량 (tree count) and
 * 가로수종류 (species) for the whole corridor, NOT one row per individual
 * tree with its own 위도/경도/수고/수관폭. There is no per-tree height or
 * canopy-width field in this dataset at all.
 *
 * `street_trees` (migration 0003) stores one Point per row, because the
 * density-scoring query (migration 0006, `ST_DWithin(path, tree_point,
 * 20)`) counts individual nearby points along a candidate route. To keep
 * that query working unchanged, each corridor is expanded into
 * `가로수수량` points evenly interpolated along its start→end line —
 * linear lat/lon interpolation, not geodesic, which is an acceptable
 * approximation at 가로수길 length scales (same simplification this
 * project already uses elsewhere, e.g. ingest-dog-density.ts's polygon-area
 * approximation). `height_m`/`canopy_width_m` are always null since the
 * source has no such field. Species and height_m/canopy_width_m stay
 * available as columns for a future dataset that does have them.
 *
 * The source file is nationwide (10,423 corridors), and interpolating by
 * declared tree count balloons that to ~1.8M points if ingested as-is - two
 * orders of magnitude larger than any other table in this project, for a
 * project whose service area is Seoul + a 3km Yongin radius. Corridors are
 * filtered to that service area (the same two circles ingest-benches.ts
 * already queries) before interpolating, mirroring how ingest-benches.ts
 * scopes its own Overpass query.
 */

import { readField, readNumberField } from "./lib/gov-data-client.js";
import { readLocalDataFile } from "./lib/file-data-client.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";
import { isWithinRadiusMeters } from "../../src/lib/geo.js";
import {
  MYONGJI_CAMPUS_CENTER,
  MYONGJI_SERVICE_RADIUS_M,
  SEOUL_CITY_HALL_CENTER,
  SEOUL_COARSE_RADIUS_M
} from "../../src/constants/walk-tuning.js";

const SOURCE = "standard_data_street_trees";
const DATA_FILE = "street-trees"; // jobs/ingest/data/street-trees.csv|xlsx|xls

// Guards against a bad/outlier tree-count value blowing up row count for a
// single corridor - 500 trees along one street is already generous.
const MAX_POINTS_PER_CORRIDOR = 500;

function isInServiceArea(point: { lat: number; lon: number }): boolean {
  return (
    isWithinRadiusMeters(SEOUL_CITY_HALL_CENTER, point, SEOUL_COARSE_RADIUS_M) ||
    isWithinRadiusMeters(MYONGJI_CAMPUS_CENTER, point, MYONGJI_SERVICE_RADIUS_M)
  );
}

type LatLon = { lat: number; lon: number };

function interpolatePoints(start: LatLon, end: LatLon, count: number): LatLon[] {
  const n = Math.max(1, Math.min(count, MAX_POINTS_PER_CORRIDOR));

  if (n === 1) {
    return [start];
  }

  const points: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lon: start.lon + (end.lon - start.lon) * t
    });
  }

  return points;
}

async function main(): Promise<void> {
  console.log("[ingest-street-trees] Reading 전국가로수길정보표준데이터 from local file...");
  const items = await readLocalDataFile(DATA_FILE);
  console.log(`[ingest-street-trees] ${items.length} corridor records read.`);

  await clearBySource("street_trees", "source", SOURCE);

  const rows = [];
  let skippedCorridors = 0;
  let outsideServiceArea = 0;

  for (const item of items) {
    const startLat = readNumberField(item, "가로수길시작위도");
    const startLon = readNumberField(item, "가로수길시작경도");
    const endLat = readNumberField(item, "가로수길종료위도");
    const endLon = readNumberField(item, "가로수길종료경도");

    if (startLat === null || startLon === null || endLat === null || endLon === null) {
      skippedCorridors += 1;
      continue;
    }

    const start = { lat: startLat, lon: startLon };
    const end = { lat: endLat, lon: endLon };

    if (!isInServiceArea(start) && !isInServiceArea(end)) {
      outsideServiceArea += 1;
      continue;
    }

    const species = readField(item, "가로수종류", "수종", "species") ?? null;
    const treeCount = readNumberField(item, "가로수수량") ?? 1;

    const points = interpolatePoints(start, end, treeCount);

    for (const point of points) {
      rows.push({
        external_id: null,
        source: SOURCE,
        point: toEwktPoint(point.lon, point.lat),
        species,
        height_m: null,
        canopy_width_m: null
      });
    }
  }

  console.log(
    `[ingest-street-trees] ${rows.length} interpolated tree points to insert ` +
      `(${skippedCorridors} corridors skipped for missing coordinates, ` +
      `${outsideServiceArea} skipped as outside the service area).`
  );

  const inserted = await insertInBatches("street_trees", rows);
  console.log(`[ingest-street-trees] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-street-trees] Failed:", error);
  process.exitCode = 1;
});
