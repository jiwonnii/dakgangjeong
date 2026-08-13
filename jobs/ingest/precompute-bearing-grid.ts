/**
 * Nightly batch (spec 7.3: "배치 처리(1일 1회): ... 격자별 방위 분포") that
 * recomputes `bearing_grid` for the entire service area (spec 2): Seoul
 * (coarse circle) union the Myongji Yongin campus circle. Run with:
 *
 *   npm run precompute:bearings
 *
 * This is a full recompute, not an incremental update: the table is
 * cleared and rebuilt each run, which is the simplest correct way to
 * handle road_segments changing between runs (a road disappearing should
 * make its cell's count drop, not linger from a stale row).
 */

import { Client as PgClient } from "pg";
import { getSupabaseAdminClient } from "../../src/lib/supabase.js";
import { enumerateGridCellsInRadius, gridKeyForPoint, type LatLon } from "../../src/lib/geo.js";
import {
  BEARING_GRID_CELL_SIZE_M,
  BEARING_SEARCH_RADIUS_M,
  MYONGJI_CAMPUS_CENTER,
  MYONGJI_SERVICE_RADIUS_M,
  SEOUL_CITY_HALL_CENTER,
  SEOUL_COARSE_RADIUS_M
} from "../../src/constants/walk-tuning.js";

const CELLS_PER_RPC_CALL = 300;
const ROWS_PER_INSERT = 1000;

type GridCell = {
  gridKey: string;
  center: LatLon;
};

type BearingGridRow = {
  grid_key: string;
  bearing_bin: number;
  center_lat: number;
  center_lon: number;
  road_count: number;
  computed_at: string;
};

function buildServiceAreaCells(): GridCell[] {
  const seoulCells = enumerateGridCellsInRadius(
    SEOUL_CITY_HALL_CENTER,
    SEOUL_COARSE_RADIUS_M,
    BEARING_GRID_CELL_SIZE_M
  );
  const yonginCells = enumerateGridCellsInRadius(
    MYONGJI_CAMPUS_CENTER,
    MYONGJI_SERVICE_RADIUS_M,
    BEARING_GRID_CELL_SIZE_M
  );

  const cellsByGridKey = new Map<string, LatLon>();

  for (const center of [...seoulCells, ...yonginCells]) {
    const gridKey = gridKeyForPoint(center, BEARING_GRID_CELL_SIZE_M);
    cellsByGridKey.set(gridKey, center);
  }

  return Array.from(cellsByGridKey.entries()).map(([gridKey, center]) => ({ gridKey, center }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function clearBearingGrid(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("bearing_grid").delete().neq("grid_key", "");

  if (error) {
    throw new Error(`Failed to clear bearing_grid before recompute: ${error.message}`);
  }
}

/**
 * Runs `compute_bearing_grid_counts` over a direct Postgres connection
 * (`DATABASE_URL`) instead of the Supabase REST API — same reason as
 * ingest-road-segments.ts's overlay RPCs: PostgREST's role-level
 * `statement_timeout` gets hit once road_segments has real rows to scan
 * against (this is the first time this script has ever run against a
 * populated road_segments table). Confirmed 2026-08-10.
 */
async function computeChunk(cells: GridCell[]): Promise<BearingGridRow[]> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — required for bearing-grid precompute.");
  }

  const client = new PgClient({ connectionString });
  await client.connect();

  let rows: Array<{ cell_index: number; bearing_bin: number; road_count: number }>;

  try {
    await client.query("set statement_timeout = '300s'");
    const result = await client.query(
      "select * from public.compute_bearing_grid_counts($1, $2, $3, $4)",
      [
        cells.map((_, index) => index),
        cells.map((cell) => cell.center.lon),
        cells.map((cell) => cell.center.lat),
        BEARING_SEARCH_RADIUS_M
      ]
    );
    rows = result.rows;
  } finally {
    await client.end();
  }

  const computedAt = new Date().toISOString();

  return rows.map((row) => {
    const cell = cells[row.cell_index];
    return {
      grid_key: cell.gridKey,
      bearing_bin: row.bearing_bin,
      center_lat: cell.center.lat,
      center_lon: cell.center.lon,
      road_count: row.road_count,
      computed_at: computedAt
    };
  });
}

async function insertRows(rows: BearingGridRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();

  for (const batch of chunk(rows, ROWS_PER_INSERT)) {
    const { error } = await supabase.from("bearing_grid").insert(batch);

    if (error) {
      throw new Error(`Failed to insert bearing_grid rows: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("[precompute-bearing-grid] Enumerating service-area grid cells...");
  const cells = buildServiceAreaCells();
  console.log(`[precompute-bearing-grid] ${cells.length} grid cells to process.`);

  console.log("[precompute-bearing-grid] Clearing existing bearing_grid rows...");
  await clearBearingGrid();

  const cellChunks = chunk(cells, CELLS_PER_RPC_CALL);
  let processedCells = 0;
  let insertedRows = 0;

  for (const cellChunk of cellChunks) {
    const rows = await computeChunk(cellChunk);
    await insertRows(rows);

    processedCells += cellChunk.length;
    insertedRows += rows.length;

    console.log(
      `[precompute-bearing-grid] ${processedCells}/${cells.length} cells processed ` +
        `(${insertedRows} non-zero bin rows so far).`
    );
  }

  console.log(
    `[precompute-bearing-grid] Done. ${cells.length} cells, ${insertedRows} rows written.`
  );
}

main().catch((error) => {
  console.error("[precompute-bearing-grid] Failed:", error);
  process.exitCode = 1;
});
