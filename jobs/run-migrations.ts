/**
 * One-off runner for supabase migrations against DATABASE_URL
 * (direct Postgres connection, not the Supabase REST API — the service-role
 * REST key can't run DDL). See docs/... / memory for why this exists: the
 * project has no local Postgres and no Supabase CLI set up, so this is the
 * fastest path to apply the SQL files without the user hand-copying each
 * one into the dashboard SQL Editor.
 *
 * Not wired into package.json scripts — this is a temporary bootstrap tool,
 * not part of the app's normal lifecycle. Each file already uses
 * `create table if not exists` / `create or replace function` etc., so
 * re-running this script is safe.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_DIR = path.resolve(__dirname, "..", "supabase");
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, "migrations");

// dog_breeds_seed.sql creates+seeds `dog_breeds`, which 0003's `breed_exercise`
// table has a foreign key to — must run first. It was never applied to this
// database (discovered via a live table listing: only the 0001/0002-era
// tables existed, no dog_breeds).
const FILES = [
  path.join(MIGRATIONS_DIR, "0001_init.sql"),
  path.join(MIGRATIONS_DIR, "0002_onboarding_survey_consent.sql"),
  path.join(SUPABASE_DIR, "dog_breeds_seed.sql"),
  path.join(MIGRATIONS_DIR, "0003_walk_recommendation.sql"),
  path.join(MIGRATIONS_DIR, "0004_bearing_grid_function.sql"),
  path.join(MIGRATIONS_DIR, "0005_park_polygon_lookup.sql"),
  path.join(MIGRATIONS_DIR, "0006_score_route_candidates.sql"),
  path.join(MIGRATIONS_DIR, "0007_road_overlay_matching.sql"),
  path.join(MIGRATIONS_DIR, "0008_bearing_grid_index_fix.sql"),
  path.join(MIGRATIONS_DIR, "0009_scoring_index_fix.sql"),
  path.join(MIGRATIONS_DIR, "0010_walk_records_route_geojson.sql"),
  path.join(MIGRATIONS_DIR, "0011_care_recurring_routines.sql"),
  path.join(MIGRATIONS_DIR, "0012_walk_records_recommended_course.sql"),
  path.join(MIGRATIONS_DIR, "0013_walk_records_review_factors.sql")
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log("[run-migrations] Connected.");

  try {
    for (const filePath of FILES) {
      const label = path.basename(filePath);
      const sql = fs.readFileSync(filePath, "utf-8");
      console.log(`\n=== Running ${label} ===`);
      await client.query(sql);
      console.log(`[run-migrations] ${label} OK.`);
    }

    console.log(`\n[run-migrations] All ${FILES.length} migration files applied successfully.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[run-migrations] Failed:", error);
  process.exitCode = 1;
});
