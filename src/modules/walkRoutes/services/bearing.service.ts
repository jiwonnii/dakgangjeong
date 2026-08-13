/**
 * I/O layer for 방위 선정 (spec 5.3): reads precomputed road counts from
 * `bearing_grid`, falling back to a live single-cell computation (via the
 * same PostGIS RPC the nightly batch uses) when the grid cell has not been
 * precomputed yet — e.g. a fresh deployment before the first batch run, or
 * a point right at the edge of the service area circle.
 */

import { getSupabaseAdminClient } from "../../../lib/supabase";
import { AppError } from "../../../lib/app-error";
import { gridKeyForPoint, type LatLon } from "../../../lib/geo";
import { BEARING_GRID_CELL_SIZE_M, BEARING_SEARCH_RADIUS_M } from "../../../constants/walk-tuning";
import {
  EMPTY_ROAD_COUNTS_BY_BEARING,
  type RoadCountsByBearing
} from "../domain/bearing-selection";
import type { BearingBin } from "../../../types/domain";

type BearingCountRow = { bearing_bin: number; road_count: number };

function mergeRowsIntoCounts(rows: BearingCountRow[]): RoadCountsByBearing {
  const counts: RoadCountsByBearing = { ...EMPTY_ROAD_COUNTS_BY_BEARING };

  for (const row of rows) {
    counts[row.bearing_bin as BearingBin] = row.road_count;
  }

  return counts;
}

/**
 * Returns the 8-bin road count around `origin`'s canonical grid cell. Never
 * throws for "no roads found" — an empty/all-zero result is valid data
 * (the coverage gate in bearing-selection.ts is what decides whether that
 * is acceptable), it only throws on an actual query failure.
 */
export async function getRoadCountsByBearing(origin: LatLon): Promise<RoadCountsByBearing> {
  const gridKey = gridKeyForPoint(origin, BEARING_GRID_CELL_SIZE_M);
  const supabase = getSupabaseAdminClient();

  const { data: cachedRows, error: cacheError } = await supabase
    .from("bearing_grid")
    .select("bearing_bin, road_count")
    .eq("grid_key", gridKey);

  if (cacheError) {
    throw new AppError(cacheError.message, 500, "BEARING_GRID_LOOKUP_FAILED");
  }

  if (cachedRows && cachedRows.length > 0) {
    return mergeRowsIntoCounts(cachedRows);
  }

  const { data: liveRows, error: liveError } = await supabase.rpc(
    "compute_bearing_grid_counts",
    {
      cell_indices: [0],
      cell_lons: [origin.lon],
      cell_lats: [origin.lat],
      search_radius_m: BEARING_SEARCH_RADIUS_M
    }
  );

  if (liveError) {
    throw new AppError(liveError.message, 500, "BEARING_GRID_LIVE_COMPUTE_FAILED");
  }

  const rows: BearingCountRow[] = (liveRows ?? []).map(
    (row: { cell_index: number; bearing_bin: number; road_count: number }) => ({
      bearing_bin: row.bearing_bin,
      road_count: row.road_count
    })
  );

  return mergeRowsIntoCounts(rows);
}
