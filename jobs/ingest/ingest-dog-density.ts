/**
 * Ingests `dog_density` from 동물등록 현황 (농림축산검역본부, spec 4.1
 * #15). Genuinely two-source: registration COUNTS come from the 동물등록
 * 현황 dataset, but that dataset does not include 읍면동 BOUNDARY
 * polygons — those come from a separate administrative-boundary source
 * (VWorld, already established as a project data source for spec 4.2's
 * 경사도). The two are joined here on dong_code.
 *
 * ⚠️ SECOND-HIGHEST-UNCERTAINTY SCRIPT after ingest-road-segments.ts: the
 * exact VWorld administrative-boundary endpoint/response shape was never
 * fetched live during this project's research (only VWorld's general
 * existence as a DEM/공간정보 source was established). Verify
 * `VWORLD_BOUNDARY_ENDPOINT` and `extractPolygonRings` below against a
 * real response before running.
 *
 * Run with: npm run ingest:dog-density
 */

import { AppError } from "../../src/lib/app-error.js";
import { env } from "../../src/config/env.js";
import { fetchAllGovDataItems, readField, readNumberField, type GovDataItem } from "./lib/gov-data-client.js";
import { upsertInBatches } from "./lib/upsert-batch.js";
import { toEwktPolygon } from "./lib/geo-format.js";

const REGISTRATION_ENDPOINT =
  "https://api.odcloud.kr/api/15098931/v1/uddi:animal-registration-status"; // 동물등록 현황
const VWORLD_BOUNDARY_ENDPOINT = "https://api.vworld.kr/req/data"; // 행정동 경계 (data.go.kr 계정과 별개 키 필요)

type DongBoundary = {
  dongCode: string;
  dongName: string;
  rings: [number, number][][];
  areaSqmFromSource: number | null;
};

/** Shoelace-formula polygon area, equirectangular-projected around the
 * ring's own latitude — accurate to well under 1% for a feature the size
 * of a single 읍면동, which is all this needs (an exact geodesic area
 * library would be overkill here). */
function approximatePolygonAreaSqm(ring: [number, number][]): number {
  const METERS_PER_DEGREE_LAT = 111320;
  const avgLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((avgLat * Math.PI) / 180);

  const projected = ring.map(([lon, lat]) => [
    lon * metersPerDegreeLon,
    lat * METERS_PER_DEGREE_LAT
  ]);

  let twiceArea = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    twiceArea += x1 * y2 - x2 * y1;
  }

  return Math.abs(twiceArea) / 2;
}

async function fetchDongBoundaries(): Promise<Map<string, DongBoundary>> {
  if (!env.VWORLD_API_KEY) {
    throw new AppError("VWORLD_API_KEY is not configured.", 500, "VWORLD_API_KEY_MISSING");
  }

  console.log("[ingest-dog-density] Fetching 읍면동 경계 (VWorld)...");

  const url = new URL(VWORLD_BOUNDARY_ENDPOINT);
  url.searchParams.set("service", "data");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("data", "LT_C_ADEMD_INFO"); // 읍면동 경계 레이어 (VWorld 데이터 카탈로그 코드, 확인 필요)
  url.searchParams.set("key", env.VWORLD_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("size", "5000");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new AppError(
      `VWorld boundary request failed with status ${response.status}.`,
      502,
      "VWORLD_REQUEST_FAILED"
    );
  }

  const payload = (await response.json()) as {
    response?: {
      result?: {
        featureCollection?: {
          features?: Array<{
            properties: Record<string, string>;
            geometry: { type: string; coordinates: unknown };
          }>;
        };
      };
    };
  };

  const features = payload.response?.result?.featureCollection?.features ?? [];
  const boundaries = new Map<string, DongBoundary>();

  for (const feature of features) {
    const dongCode = feature.properties.emd_cd ?? feature.properties.EMD_CD;
    const dongName = feature.properties.emd_nm ?? feature.properties.EMD_NM;

    if (!dongCode || !dongName) {
      continue;
    }

    const rings = extractPolygonRings(feature.geometry);

    if (!rings || rings.length === 0) {
      continue;
    }

    boundaries.set(dongCode, {
      dongCode,
      dongName,
      rings,
      areaSqmFromSource: null
    });
  }

  console.log(`[ingest-dog-density] ${boundaries.size} dong boundaries parsed.`);
  return boundaries;
}

function extractPolygonRings(geometry: { type: string; coordinates: unknown }): [number, number][][] | null {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as [number, number][][];
  }

  if (geometry.type === "MultiPolygon") {
    // Use the largest ring-set (by vertex count) as an approximation when a
    // dong is represented as multiple disjoint polygons (rare, e.g. an
    // administrative area split by a river) — full multi-polygon storage
    // would need `dog_density.geom` to accept MultiPolygon, which the
    // migration 0003 schema allows (generic Geometry column), but the area
    // approximation above only handles a single ring; picking the largest
    // part is a reasonable simplification for a density estimate.
    const polygons = geometry.coordinates as [number, number][][][];
    return polygons.reduce((largest, candidate) =>
      candidate[0].length > (largest[0]?.length ?? 0) ? candidate : largest
    );
  }

  return null;
}

async function main(): Promise<void> {
  const [registrationItems, boundaries] = await Promise.all([
    (async () => {
      console.log("[ingest-dog-density] Fetching 동물등록 현황...");
      const items = await fetchAllGovDataItems(REGISTRATION_ENDPOINT);
      console.log(`[ingest-dog-density] ${items.length} registration records fetched.`);
      return items;
    })(),
    fetchDongBoundaries()
  ]);

  // dog_density has no `source` column (migration 0003) — it is keyed by
  // the naturally unique `dong_code` instead, so upserting by that column
  // is both the idempotent-rerun mechanism and the natural way to refresh
  // counts without needing a clear-then-insert pass.
  const rows = [];
  let unmatched = 0;

  for (const item of registrationItems as GovDataItem[]) {
    const dongCode = readField(item, "행정동코드", "region_code", "dong_code");
    const registeredCount = readNumberField(item, "등록건수", "registered_count") ?? 0;

    if (!dongCode) {
      continue;
    }

    const boundary = boundaries.get(dongCode);

    if (!boundary) {
      unmatched += 1;
      continue;
    }

    const areaSqm = boundary.areaSqmFromSource ?? approximatePolygonAreaSqm(boundary.rings[0]);
    const areaSqkm = areaSqm / 1_000_000;

    rows.push({
      dong_code: dongCode,
      dong_name: boundary.dongName,
      geom: toEwktPolygon(boundary.rings),
      registered_count: registeredCount,
      area_sqkm: areaSqkm,
      density_per_sqkm: areaSqkm > 0 ? registeredCount / areaSqkm : null
    });
  }

  console.log(
    `[ingest-dog-density] ${rows.length} rows to upsert (${unmatched} registration rows had no matching boundary).`
  );

  const written = await upsertInBatches("dog_density", rows, "dong_code");
  console.log(`[ingest-dog-density] Done: ${written} rows upserted.`);
}

main().catch((error) => {
  console.error("[ingest-dog-density] Failed:", error);
  process.exitCode = 1;
});
