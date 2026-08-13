/**
 * Ingests `parks` from 전국도시공원정보표준데이터 (spec 4.1 #4).
 *
 * Unlike the other 7 표준데이터 sources in this project, this one has no
 * file-download option on data.go.kr — 활용신청 + OpenAPI is the only way
 * to get this dataset, confirmed by the user actually applying for and
 * using the API. Every other 표준데이터 ingest script reads a local file
 * (see file-data-client.ts); this is the one exception.
 *
 * Field names verified against a real live response (2026-08-10, once the
 * user found the actual approved endpoint — the originally-guessed
 * `api.odcloud.kr` URL 404'd): this dataset uses English camelCase field
 * names (`manageNo`, `parkNm`, `parkSe`, `latitude`, `longitude`, `parkAr`),
 * NOT the Korean field names (관리번호/공원명/...) most other 표준데이터
 * sources in this project use. Confirmed as point data, not polygon/
 * boundary — one coordinate pair per park.
 *
 * Since the source is a single point per park (no boundary polygon), each
 * row is stored as a Point with `radius_m` derived from 공원면적 (treating
 * the park as a circle: r = sqrt(area / π)) — matching the `parks` table's
 * Point-with-radius design (migration 0003) for exactly this situation.
 * `find_nearby_park_polygons` (migration 0005) buffers it back into a
 * Polygon at query time.
 *
 * Run with: npm run ingest:parks
 */

import { fetchAllGovDataItems, readField, readNumberField } from "./lib/gov-data-client.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";

const SOURCE = "standard_data_urban_parks";
const ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api"; // 전국도시공원정보표준데이터 (user-confirmed 2026-08-10)

function radiusFromAreaSqm(areaSqm: number | null): number | null {
  if (areaSqm === null || areaSqm <= 0) {
    return null;
  }

  return Math.sqrt(areaSqm / Math.PI);
}

async function main(): Promise<void> {
  console.log("[ingest-parks] Fetching 전국도시공원정보표준데이터...");
  const items = await fetchAllGovDataItems(ENDPOINT);
  console.log(`[ingest-parks] ${items.length} records fetched.`);

  await clearBySource("parks", "source", SOURCE);

  const rows = [];
  let skipped = 0;

  for (const item of items) {
    const lat = readNumberField(item, "latitude", "위도");
    const lon = readNumberField(item, "longitude", "경도");
    const name = readField(item, "parkNm", "공원명");

    if (lat === null || lon === null || !name) {
      skipped += 1;
      continue;
    }

    const areaSqm = readNumberField(item, "parkAr", "공원면적");

    rows.push({
      external_id: readField(item, "manageNo", "관리번호") ?? null,
      source: SOURCE,
      name,
      park_type: readField(item, "parkSe", "공원구분") ?? null,
      geom: toEwktPoint(lon, lat),
      radius_m: radiusFromAreaSqm(areaSqm),
      area_sqm: areaSqm
    });
  }

  console.log(`[ingest-parks] ${rows.length} rows to insert (${skipped} skipped for missing lat/lon/name).`);

  const inserted = await insertInBatches("parks", rows);
  console.log(`[ingest-parks] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-parks] Failed:", error);
  process.exitCode = 1;
});
