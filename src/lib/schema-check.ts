import { supabaseAdmin } from "./supabase";

/**
 * What the application code expects to find in the database.
 *
 * `schema.sql` (now `migrations/0001_init.sql`) uses `create table if not
 * exists`, so adding a column there does NOT change a database whose tables
 * already exist. Columns introduced after the first deploy therefore live in a
 * follow-up migration, and each group below points at the migration that
 * actually creates it. Keep this list in sync whenever a migration is added.
 */
type SchemaExpectation = {
  table: string;
  columns: string[];
  /** Path of the SQL file to run, relative to the `supabase/` directory. */
  migration: string;
  /** Code falls back gracefully when these are missing, so only warn. */
  optional?: boolean;
};

export const expectedSchema: SchemaExpectation[] = [
  {
    table: "guardian_profiles",
    columns: ["id", "display_name", "created_at", "updated_at"],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "guardian_profiles",
    columns: [
      "location_permission_agreed",
      "notification_permission_agreed",
      "marketing_agreed",
      "location_permission_agreed_at",
      "notification_permission_agreed_at",
      "marketing_agreed_at"
    ],
    migration: "migrations/0002_onboarding_survey_consent.sql"
  },
  {
    table: "dogs",
    columns: [
      "id",
      "owner_id",
      "name",
      "breed",
      "birth_date",
      "weight_kg",
      "health_notes",
      "invite_code",
      "created_at",
      "updated_at"
    ],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "dogs",
    columns: ["social_preference", "personality_tags"],
    migration: "migrations/0002_onboarding_survey_consent.sql"
  },
  {
    table: "dog_guardians",
    columns: ["dog_id", "user_id", "role", "joined_at"],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "walk_records",
    columns: [
      "id",
      "dog_id",
      "user_id",
      "started_at",
      "ended_at",
      "distance_meters",
      "duration_seconds",
      "average_speed_mps",
      "route",
      "route_geojson",
      "static_map_url",
      "rating",
      "liked_notes",
      "disliked_notes",
      "ai_summary",
      "created_at"
    ],
    migration: "migrations/0010_walk_records_route_geojson.sql"
  },
  {
    table: "walk_records",
    columns: ["recommended_course"],
    migration: "migrations/0012_walk_records_recommended_course.sql"
  },
  {
    table: "walk_records",
    columns: ["liked_factor", "disliked_factor"],
    migration: "migrations/0013_walk_records_review_factors.sql"
  },
  {
    table: "care_tasks",
    columns: [
      "id",
      "dog_id",
      "task_type",
      "title",
      "scheduled_for",
      "completed_at",
      "completed_by",
      "note",
      "created_at"
    ],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "care_notes",
    columns: ["id", "dog_id", "user_id", "note", "created_at"],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "risk_zones",
    columns: [
      "id",
      "type",
      "severity",
      "source",
      "description",
      "geom",
      "created_at"
    ],
    migration: "migrations/0001_init.sql"
  },
  {
    table: "dog_breeds",
    columns: [
      "id",
      "name_ko",
      "name_en",
      "group_name",
      "aliases",
      "is_popular",
      "source",
      "sort_order"
    ],
    migration: "dog_breeds_seed.sql",
    optional: true
  },
  {
    table: "road_segments",
    columns: [
      "id",
      "external_id",
      "source",
      "path",
      "road_class",
      "lanes",
      "max_speed_kmh",
      "average_slope",
      "lit",
      "is_pedestrian_only",
      "is_pedestrian_priority",
      "is_school_zone",
      "has_speed_bump",
      "vehicle_exposure",
      "length_m"
    ],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "street_trees",
    columns: ["id", "external_id", "source", "point", "species", "height_m", "canopy_width_m"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "parks",
    columns: ["id", "external_id", "source", "name", "park_type", "geom", "radius_m", "area_sqm"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "benches",
    columns: ["id", "external_id", "source", "point"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "streetlights",
    columns: ["id", "external_id", "source", "point", "light_type"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "dog_density",
    columns: [
      "id",
      "dong_code",
      "dong_name",
      "geom",
      "registered_count",
      "area_sqkm",
      "density_per_sqkm"
    ],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "pet_facilities",
    columns: ["id", "external_id", "source", "point", "facility_type", "name"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "breed_exercise",
    columns: [
      "breed_id",
      "kc_grade",
      "size_class",
      "is_brachycephalic",
      "is_double_coat",
      "senior_age_years_override",
      "source"
    ],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "bearing_grid",
    columns: ["grid_key", "bearing_bin", "center_lat", "center_lon", "road_count", "computed_at"],
    migration: "migrations/0003_walk_recommendation.sql"
  },
  {
    table: "walk_course_cache",
    columns: ["cache_key", "payload", "expires_at", "created_at"],
    migration: "migrations/0003_walk_recommendation.sql"
  }
];

export type SchemaProblem = {
  table: string;
  migration: string;
  optional: boolean;
  missingTable: boolean;
  missingColumns: string[];
};

export type SchemaCheckResult =
  | { status: "skipped"; reason: string }
  | { status: "ok" }
  | { status: "problems"; problems: SchemaProblem[] };

const MISSING_COLUMN = "42703";

async function probe(table: string, columns: string[]) {
  const client = supabaseAdmin!;
  // `limit(0)` validates the column list without transferring any rows.
  const { error } = await client.from(table).select(columns.join(", ")).limit(0);
  return error;
}

async function inspectGroup(
  expectation: SchemaExpectation
): Promise<SchemaProblem | null> {
  const error = await probe(expectation.table, expectation.columns);

  if (!error) {
    return null;
  }

  const base = {
    table: expectation.table,
    migration: expectation.migration,
    optional: Boolean(expectation.optional)
  };

  if (error.code !== MISSING_COLUMN) {
    // Missing table (PGRST205) or anything else we cannot attribute to a
    // single column - report the whole group.
    return { ...base, missingTable: true, missingColumns: [] };
  }

  // Postgres only names the first offending column, so probe each one to
  // report the complete list in a single pass.
  const missingColumns: string[] = [];

  for (const column of expectation.columns) {
    const columnError = await probe(expectation.table, [column]);

    if (columnError) {
      missingColumns.push(column);
    }
  }

  return { ...base, missingTable: false, missingColumns };
}

export async function checkDatabaseSchema(): Promise<SchemaCheckResult> {
  if (!supabaseAdmin) {
    return {
      status: "skipped",
      reason: "SUPABASE_SERVICE_ROLE_KEY is not set."
    };
  }

  const results = await Promise.all(expectedSchema.map(inspectGroup));
  const problems = results.filter((problem): problem is SchemaProblem =>
    Boolean(problem)
  );

  return problems.length === 0 ? { status: "ok" } : { status: "problems", problems };
}

export function formatSchemaCheckResult(result: SchemaCheckResult) {
  if (result.status === "skipped") {
    return [`[db] Schema check skipped. ${result.reason}`];
  }

  if (result.status === "ok") {
    return ["[db] Schema check passed. Database matches what the code expects."];
  }

  const blocking = result.problems.filter((problem) => !problem.optional);
  const migrations = Array.from(
    new Set(result.problems.map((problem) => problem.migration))
  );

  const lines = [
    "",
    "==================================================================",
    blocking.length > 0
      ? "[db] SCHEMA MISMATCH - the database is missing things the code uses."
      : "[db] Schema warning - optional tables are missing.",
    "==================================================================",
    ""
  ];

  for (const problem of result.problems) {
    const label = problem.optional ? "warning" : "required";

    if (problem.missingTable) {
      lines.push(`  - [${label}] table "${problem.table}" is missing entirely`);
    } else {
      lines.push(
        `  - [${label}] table "${problem.table}" is missing columns: ${problem.missingColumns.join(", ")}`
      );
    }

    lines.push(`      fix: run supabase/${problem.migration}`);
  }

  lines.push(
    "",
    "  How to apply:",
    "    1. Open the Supabase dashboard for this project",
    "    2. Go to SQL Editor -> New query",
    "    3. Paste the file(s) below and press Run",
    ""
  );

  for (const migration of migrations) {
    lines.push(`       supabase/${migration}`);
  }

  lines.push(
    "",
    "  Each migration is safe to run more than once.",
    "==================================================================",
    ""
  );

  return lines;
}

export async function reportDatabaseSchema() {
  try {
    const result = await checkDatabaseSchema();

    for (const line of formatSchemaCheckResult(result)) {
      console.log(line);
    }

    return result;
  } catch (error) {
    console.log(
      `[db] Schema check could not run: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
