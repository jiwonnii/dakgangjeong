import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const migrationFiles = [
  "supabase/migrations/0001_init.sql",
  "supabase/dog_breeds_seed.sql",
  "supabase/migrations/0002_onboarding_survey_consent.sql",
  "supabase/migrations/0003_walk_recommendation.sql",
  "supabase/migrations/0004_bearing_grid_function.sql",
  "supabase/migrations/0005_park_polygon_lookup.sql",
  "supabase/migrations/0006_score_route_candidates.sql",
  "supabase/migrations/0007_road_overlay_matching.sql",
  "supabase/migrations/0008_bearing_grid_index_fix.sql",
  "supabase/migrations/0009_scoring_index_fix.sql",
  "supabase/migrations/0010_walk_records_route_geojson.sql",
  "supabase/migrations/0011_care_recurring_routines.sql"
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing from .env.");
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  try {
    for (const file of migrationFiles) {
      const absolutePath = path.resolve(file);
      const sql = await readFile(absolutePath, "utf8");
      process.stdout.write(`[db] applying ${file} ... `);
      await client.query(sql);
      process.stdout.write("ok\n");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n[db] migration failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
