/**
 * Ingests `road_segments` (spec 4.1 rows 3, 6, 7, 8, 9, 10) in three
 * phases:
 *
 *   1. 국가표준노드링크 LINK data → base rows (road_class, lanes,
 *      max_speed_kmh, and a first-pass vehicle_exposure from those alone).
 *   2. Five overlay datasets (보행자전용/보행자우선/어린이보호구역/
 *      과속방지턱/보안등) are matched against those rows via the
 *      migration 0007 RPCs, setting the corresponding boolean flags.
 *   3. Every row is re-read and vehicle_exposure is recomputed with
 *      vehicle-exposure.ts's calculateVehicleExposure, now including the
 *      overlay flags — this is a full-table read+write pass rather than a
 *      SQL-side recompute so the formula lives in exactly one place (see
 *      that file's doc comment).
 *
 * Run with: npm run ingest:road-segments
 *
 * 국가표준노드링크 turned out to be a SHP (Shapefile) file download, not an
 * OpenAPI — confirmed 2026-08-10 via its.go.kr/nodelink/nodelinkRef (no
 * login needed, ~257MB nationwide zip, updated roughly monthly). Expects
 * `MOCT_LINK.shp`/`.dbf`/`.shx`/`.prj` extracted (flattened, no dated
 * subfolder) into `jobs/ingest/data/nodelink/`. Field names inside the DBF
 * (LINK_ID, ROAD_RANK, LANES, MAX_SPD, ...) matched this project's original
 * guess exactly — only the transport format was wrong.
 *
 * The SHP's coordinates are in a Korean Transverse Mercator projection
 * (read from the real MOCT_LINK.prj: ITRF2000 datum, false easting 200000,
 * false northing 600000, central meridian 127°, latitude of origin 38° —
 * equivalent to EPSG:5186 "Korea 2000 / Central Belt 2010" to well within
 * this project's precision needs), reprojected to WGS84 via proj4 below.
 *
 * Nationwide, this dataset is large enough (~1M+ LINK records) that
 * ingesting it unfiltered isn't worth it for a project whose service area
 * is Seoul + a 3km Yongin radius — same reasoning as
 * ingest-street-trees.ts's service-area filter, reused here via the same
 * isWithinRadiusMeters/circle constants.
 */

import shapefile from "shapefile";
import proj4 from "proj4";
import path from "node:path";
import {
  readField,
  readNumberField,
  type GovDataItem
} from "./lib/gov-data-client.js";
import { readLocalDataFile } from "./lib/file-data-client.js";
import { fetchStreetlightsInServiceArea } from "./ingest-streetlights.js";
import { chunk, clearBySource, fetchAllRows, insertInBatches } from "./lib/upsert-batch.js";
import {
  ROAD_RANK_TO_ROAD_CLASS,
  calculateVehicleExposure,
  isRoadRankWalkable
} from "./lib/vehicle-exposure.js";
import { Client as PgClient } from "pg";
import { isWithinRadiusMeters } from "../../src/lib/geo.js";
import {
  MYONGJI_CAMPUS_CENTER,
  MYONGJI_SERVICE_RADIUS_M,
  ROAD_OVERLAY_MATCH_BUFFER_M,
  SEOUL_CITY_HALL_CENTER,
  SEOUL_COARSE_RADIUS_M
} from "../../src/constants/walk-tuning.js";
import type { RoadSegmentClass } from "../../src/types/domain.js";
import { toEwktLineString } from "./lib/geo-format.js";

const SOURCE_NODE_LINK = "node_link";

const NODELINK_DIR = path.resolve(process.cwd(), "jobs/ingest/data/nodelink");
const NODELINK_SHP_PATH = path.join(NODELINK_DIR, "MOCT_LINK.shp");
const NODELINK_DBF_PATH = path.join(NODELINK_DIR, "MOCT_LINK.dbf");

// Exact params from the downloaded MOCT_LINK.prj — see file header.
const KOREA_CENTRAL_BELT_PROJ4 =
  "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs";
const projectionToWgs84 = proj4(KOREA_CENTRAL_BELT_PROJ4, "WGS84");

function reprojectToWgs84(coordinates: readonly [number, number][]): [number, number][] {
  return coordinates.map((point) => projectionToWgs84.forward([...point]) as [number, number]);
}

function isInServiceArea(point: { lat: number; lon: number }): boolean {
  return (
    isWithinRadiusMeters(SEOUL_CITY_HALL_CENTER, point, SEOUL_COARSE_RADIUS_M) ||
    isWithinRadiusMeters(MYONGJI_CAMPUS_CENTER, point, MYONGJI_SERVICE_RADIUS_M)
  );
}

/**
 * Runs one of migration 0007's overlay-matching RPCs over a direct Postgres
 * connection (`DATABASE_URL`) instead of the Supabase REST API
 * (`supabase.rpc`). The REST/PostgREST path enforces a short
 * `statement_timeout` for the service role that this RPC's `ST_DWithin`
 * against a multi-thousand-point MultiPoint collection can exceed once
 * road_segments has 90K+ rows in it — confirmed 2026-08-10 ("canceling
 * statement due to statement timeout" on the very first overlay call after
 * phase 1 ingested 97,835 rows). A direct connection has no such role-level
 * cap, and this raises it further still for safety.
 */
async function runOverlayRpc(sql: string, params: unknown[]): Promise<number> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — required for road-segments overlay RPCs.");
  }

  const client = new PgClient({ connectionString });
  await client.connect();

  try {
    await client.query("set statement_timeout = '300s'");
    const result = await client.query(sql, params);
    return result.rows[0]?.updated_count ?? 0;
  } finally {
    await client.end();
  }
}

// The 4 overlay datasets below are read from local files in
// jobs/ingest/data/ (download from data.go.kr and save there) — same as
// the 4 standalone ingest-*.ts scripts for the other 표준데이터 sources.
const PEDESTRIAN_ONLY_DATA_FILE = "pedestrian-only-roads"; // 전국보행자전용도로표준데이터
const PEDESTRIAN_PRIORITY_DATA_FILE = "pedestrian-priority-roads"; // 전국보행자우선도로표준데이터
const SCHOOL_ZONE_DATA_FILE = "school-zones"; // 전국어린이보호구역표준데이터
const SPEED_BUMP_DATA_FILE = "speed-bumps"; // 전국과속방지턱표준데이터

/**
 * ⚠️ Extracts a GeoJSON LineString from a 표준노드링크 item. GIS datasets
 * like this are frequently distributed as file downloads (SHP/GeoJSON)
 * rather than embedding geometry in a JSON API response — if that turns
 * out to be the case here, replace fetchNodeLinkItems below with a local
 * file reader (e.g. a GeoJSON FeatureCollection parsed with fs.readFile)
 * instead of fetchAllGovDataItems, and adapt this function to read
 * `feature.geometry` / `feature.properties` directly. The field-name
 * fallbacks below cover the shapes this project considered most likely.
 */
function extractLineGeometry(item: GovDataItem): { type: "LineString"; coordinates: [number, number][] } | null {
  const rawGeometry = item.geometry ?? item.geom ?? item.shape;

  if (rawGeometry && typeof rawGeometry === "object") {
    const geom = rawGeometry as { type?: string; coordinates?: unknown };
    if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
      return { type: "LineString", coordinates: geom.coordinates as [number, number][] };
    }
  }

  const wkt = readField(item, "WKT", "wkt", "geom_wkt");
  if (wkt && wkt.toUpperCase().startsWith("LINESTRING")) {
    const coordText = wkt.slice(wkt.indexOf("(") + 1, wkt.lastIndexOf(")"));
    const coordinates = coordText
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);

    if (coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))) {
      return { type: "LineString", coordinates };
    }
  }

  return null;
}

function approximateLengthMeters(coordinates: [number, number][]): number {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    total += EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return total;
}

type BaseRoadSegmentRow = {
  external_id: string | null;
  source: string;
  path: string; // PostgREST accepts GeoJSON text for a geometry column via the `geography`/`geometry` cast on insert when the column's format matches; see phase-1 note.
  road_class: RoadSegmentClass;
  lanes: number | null;
  max_speed_kmh: number | null;
  length_m: number;
  vehicle_exposure: number;
};

async function ingestPhase1BaseLinks(): Promise<number> {
  console.log("[ingest-road-segments] Phase 1: reading 국가표준노드링크 SHP file...");

  await clearBySource("road_segments", "source", SOURCE_NODE_LINK);

  const source = await shapefile.open(NODELINK_SHP_PATH, NODELINK_DBF_PATH);

  const rows: BaseRoadSegmentRow[] = [];
  let totalRead = 0;
  let skippedNotWalkable = 0;
  let skippedNonLineGeometry = 0;
  let skippedOutsideServiceArea = 0;

  while (true) {
    const result = await source.read();

    if (result.done) {
      break;
    }

    totalRead += 1;
    const feature = result.value;
    const properties = feature.properties as Record<string, unknown>;
    const roadRank = properties.ROAD_RANK != null ? String(properties.ROAD_RANK) : null;

    if (!roadRank) {
      continue;
    }

    if (!isRoadRankWalkable(roadRank)) {
      skippedNotWalkable += 1;
      continue;
    }

    if (feature.geometry?.type !== "LineString") {
      // MOCT_LINK is documented as single-part polylines; a handful of
      // MultiLineString/other-shaped records would be a data-quality
      // surprise worth knowing about via the skip count, not silently
      // dropped without a trace.
      skippedNonLineGeometry += 1;
      continue;
    }

    const wgs84Coordinates = reprojectToWgs84(feature.geometry.coordinates as [number, number][]);

    if (!wgs84Coordinates.some(([lon, lat]) => isInServiceArea({ lat, lon }))) {
      skippedOutsideServiceArea += 1;
      continue;
    }

    const roadClass = ROAD_RANK_TO_ROAD_CLASS[roadRank] ?? "other";
    const lanes = typeof properties.LANES === "number" ? properties.LANES : null;
    const maxSpeedKmh = typeof properties.MAX_SPD === "number" ? properties.MAX_SPD : null;

    const vehicleExposure = calculateVehicleExposure({
      roadClass,
      lanes,
      maxSpeedKmh,
      isPedestrianOnly: false,
      isPedestrianPriority: false,
      isSchoolZone: false,
      hasSpeedBump: false
    });

    rows.push({
      external_id: properties.LINK_ID != null ? String(properties.LINK_ID) : null,
      source: SOURCE_NODE_LINK,
      path: toEwktLineString(wgs84Coordinates),
      road_class: roadClass,
      lanes,
      max_speed_kmh: maxSpeedKmh,
      length_m: approximateLengthMeters(wgs84Coordinates),
      vehicle_exposure: vehicleExposure
    });
  }

  console.log(
    `[ingest-road-segments] Phase 1: ${totalRead} LINK records read nationwide, ${rows.length} rows to insert ` +
      `(skipped ${skippedNotWalkable} motorway/trunk, ${skippedNonLineGeometry} non-LineString geometry, ` +
      `${skippedOutsideServiceArea} outside service area).`
  );

  return insertInBatches("road_segments", rows);
}

type OverlayFlagColumn = "is_pedestrian_only" | "is_pedestrian_priority" | "is_school_zone" | "has_speed_bump";

/** A (lat-candidates, lon-candidates) pair tried against each row — needed
 * because 보행자전용/우선도로 표준데이터 rows are line segments (a start
 * point + an end point under dataset-specific field-name prefixes) rather
 * than a single generic 위도/경도 pair. Both endpoints are pushed into the
 * MultiPoint match set, which is a reasonable approximation of the segment
 * given ROAD_OVERLAY_MATCH_BUFFER_M's tolerance — not a full line
 * rasterization, but the actual dataset provides no intermediate points
 * anyway. */
type PointFieldCandidates = { lat: string[]; lon: string[] };

const DEFAULT_POINT_FIELDS: PointFieldCandidates[] = [
  { lat: ["위도", "lat", "latitude"], lon: ["경도", "lon", "longitude"] }
];

async function applyOverlay(
  label: string,
  dataFileBaseName: string,
  flagColumn: OverlayFlagColumn,
  pointFieldSets: PointFieldCandidates[] = DEFAULT_POINT_FIELDS
): Promise<void> {
  console.log(`[ingest-road-segments] Phase 2: reading ${label} from local file...`);

  const items = await readLocalDataFile(dataFileBaseName);
  const points: [number, number][] = [];

  for (const item of items) {
    let matchedAny = false;

    for (const { lat: latKeys, lon: lonKeys } of pointFieldSets) {
      const lat = readNumberField(item, ...latKeys);
      const lon = readNumberField(item, ...lonKeys);

      if (lat !== null && lon !== null) {
        points.push([lon, lat]);
        matchedAny = true;
      }
    }

    if (matchedAny) {
      continue;
    }

    const geometry = extractLineGeometry(item);
    if (geometry) {
      points.push(...geometry.coordinates);
    }
  }

  console.log(`[ingest-road-segments] Phase 2: ${label} — ${points.length} points/vertices to match.`);

  if (points.length === 0) {
    return;
  }

  const geoJson = JSON.stringify({ type: "MultiPoint", coordinates: points });

  const updatedCount = await runOverlayRpc(
    "select public.mark_road_segments_near_geometry($1, $2, $3) as updated_count",
    [geoJson, flagColumn, ROAD_OVERLAY_MATCH_BUFFER_M]
  );

  console.log(`[ingest-road-segments] Phase 2: ${label} matched ${updatedCount} road_segments rows.`);
}

async function applyStreetlightOverlay(): Promise<void> {
  console.log("[ingest-road-segments] Phase 2: fetching 전국보안등정보표준데이터...");

  const streetlights = await fetchStreetlightsInServiceArea();
  const points: [number, number][] = streetlights.map(({ lat, lon }) => [lon, lat]);

  console.log(`[ingest-road-segments] Phase 2: 보안등 — ${points.length} points to match.`);

  if (points.length === 0) {
    return;
  }

  const geoJson = JSON.stringify({ type: "MultiPoint", coordinates: points });

  const updatedCount = await runOverlayRpc(
    "select public.mark_road_segments_lit_near_geometry($1, $2) as updated_count",
    [geoJson, ROAD_OVERLAY_MATCH_BUFFER_M]
  );

  console.log(`[ingest-road-segments] Phase 2: 보안등 matched ${updatedCount} road_segments rows.`);
}

type RecomputeRow = {
  id: string;
  road_class: RoadSegmentClass;
  lanes: number | null;
  max_speed_kmh: number | null;
  is_pedestrian_only: boolean;
  is_pedestrian_priority: boolean;
  is_school_zone: boolean;
  has_speed_bump: boolean;
};

async function recomputeVehicleExposure(): Promise<number> {
  console.log("[ingest-road-segments] Phase 3: re-reading all road_segments rows...");

  const rows = await fetchAllRows<RecomputeRow>(
    "road_segments",
    "id, road_class, lanes, max_speed_kmh, is_pedestrian_only, is_pedestrian_priority, is_school_zone, has_speed_bump"
  );

  const updates = rows.map((row) => ({
    id: row.id,
    vehicle_exposure: calculateVehicleExposure({
      roadClass: row.road_class,
      lanes: row.lanes,
      maxSpeedKmh: row.max_speed_kmh,
      isPedestrianOnly: row.is_pedestrian_only,
      isPedestrianPriority: row.is_pedestrian_priority,
      isSchoolZone: row.is_school_zone,
      hasSpeedBump: row.has_speed_bump
    })
  }));

  console.log(`[ingest-road-segments] Phase 3: recomputing vehicle_exposure for ${updates.length} rows...`);

  // NOT a supabase-js upsert(): Postgres validates NOT NULL columns (path,
  // road_class, length_m, ...) on the prospective INSERT row of an
  // INSERT ... ON CONFLICT DO UPDATE *before* it even checks whether the
  // conflict applies — so a partial-column upsert (just id + vehicle_
  // exposure) fails with a NOT NULL violation on `path` even though every
  // id here already exists and only an UPDATE was ever going to happen.
  // Confirmed 2026-08-10, the first time this phase ever ran against a
  // live table. A real bulk UPDATE via unnest() has no such problem.
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — required for road-segments phase 3 recompute.");
  }

  const client = new PgClient({ connectionString });
  await client.connect();

  try {
    await client.query("set statement_timeout = '300s'");
    let written = 0;

    for (const batch of chunk(updates, 1000)) {
      await client.query(
        `update public.road_segments as r
         set vehicle_exposure = v.vehicle_exposure
         from unnest($1::uuid[], $2::numeric[]) as v(id, vehicle_exposure)
         where r.id = v.id`,
        [batch.map((u) => u.id), batch.map((u) => u.vehicle_exposure)]
      );
      written += batch.length;
    }

    return written;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const inserted = await ingestPhase1BaseLinks();
  console.log(`[ingest-road-segments] Phase 1 done: ${inserted} rows inserted.`);

  await applyOverlay("전국보행자전용도로표준데이터", PEDESTRIAN_ONLY_DATA_FILE, "is_pedestrian_only", [
    { lat: ["보행자전용도로시작점위도"], lon: ["보행자전용도로시작점경도"] },
    { lat: ["보행자전용도로종료점위도"], lon: ["보행자전용도로종료점경도"] }
  ]);
  await applyOverlay(
    "전국보행자우선도로표준데이터",
    PEDESTRIAN_PRIORITY_DATA_FILE,
    "is_pedestrian_priority",
    [
      { lat: ["보행자우선도로시작점위도"], lon: ["보행자우선도로시작점경도"] },
      { lat: ["보행자우선도로종료점위도"], lon: ["보행자우선도로종료점경도"] }
    ]
  );
  await applyOverlay("전국어린이보호구역표준데이터", SCHOOL_ZONE_DATA_FILE, "is_school_zone");
  await applyOverlay("전국과속방지턱표준데이터", SPEED_BUMP_DATA_FILE, "has_speed_bump", [
    { lat: ["WGS84위도", "위도", "lat", "latitude"], lon: ["WGS84경도", "경도", "lon", "longitude"] }
  ]);
  await applyStreetlightOverlay();

  const updated = await recomputeVehicleExposure();
  console.log(`[ingest-road-segments] Phase 3 done: ${updated} rows recomputed.`);

  console.log("[ingest-road-segments] Done.");
}

main().catch((error) => {
  console.error("[ingest-road-segments] Failed:", error);
  process.exitCode = 1;
});
