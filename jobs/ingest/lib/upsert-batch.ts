/**
 * Shared batch write helpers for ingest jobs. Every ingest-*.ts script does
 * the same "clear this table's rows for the source I'm about to reload,
 * then insert in chunks" pattern precompute-bearing-grid.ts (round 5)
 * established — pulled out here so it is written once.
 */

import { getSupabaseAdminClient } from "../../../src/lib/supabase.js";

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * Deletes every row in `table` whose `sourceColumn` equals `sourceValue` —
 * i.e. "clear what a previous run of this specific ingest script wrote",
 * not the whole table. This lets tables fed by more than one source
 * (e.g. `parks` from both 전국도시공원정보표준데이터 and OSM) coexist
 * without one ingest script wiping another's rows.
 */
export async function clearBySource(
  table: string,
  sourceColumn: string,
  sourceValue: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq(sourceColumn, sourceValue);

  if (error) {
    throw new Error(`Failed to clear ${table} rows where ${sourceColumn}=${sourceValue}: ${error.message}`);
  }
}

export async function insertInBatches<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 1000
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const supabase = getSupabaseAdminClient();
  let inserted = 0;

  for (const batch of chunk(rows, batchSize)) {
    // supabase-js's insert() overloads use an excess-property-rejection
    // conditional type keyed to a concrete generated `Database` schema,
    // which this project does not use (every table access elsewhere in
    // the codebase is untyped `.from("table")` too). That conditional
    // type cannot resolve against this function's own generic `T` no
    // matter what shape T has, so the cast below is a real TS/library
    // friction point, not a runtime concern — `batch` is a plain array of
    // plain row objects.
    const { error } = await supabase.from(table).insert(batch as never[]);

    if (error) {
      throw new Error(`Failed to insert into ${table}: ${error.message}`);
    }

    inserted += batch.length;
  }

  return inserted;
}

/** Upsert-by-primary-key in batches — used by ingest-road-segments.ts's
 * phase 3 (recomputing vehicle_exposure after overlay flags are set) to
 * write back many rows in a handful of round trips instead of one PATCH
 * per row. */
export async function upsertInBatches<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  conflictColumn: string,
  batchSize = 1000
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const supabase = getSupabaseAdminClient();
  let written = 0;

  for (const batch of chunk(rows, batchSize)) {
    // See the matching comment in insertInBatches above — same supabase-js
    // generic-inference friction, not a real type hole.
    const { error } = await supabase
      .from(table)
      .upsert(batch as never[], { onConflict: conflictColumn });

    if (error) {
      throw new Error(`Failed to upsert into ${table}: ${error.message}`);
    }

    written += batch.length;
  }

  return written;
}

/** Fetches every row of `table` with only the given columns, paginating via
 * `.range()` — used by ingest-road-segments.ts's phase 3 to re-read the
 * full table for the vehicle_exposure recompute pass. */
export async function fetchAllRows<T>(
  table: string,
  columns: string,
  pageSize = 1000
): Promise<T[]> {
  const supabase = getSupabaseAdminClient();
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`);
    }

    const rows = (data ?? []) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}
