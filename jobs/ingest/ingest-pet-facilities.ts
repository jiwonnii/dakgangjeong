/**
 * Ingests `pet_facilities` from two sources (spec 4.1 #16):
 * 동물병원 인허가정보 (→ facility_type='hospital') and a general 반려동물
 * 영업장 dataset (→ 'grooming'/'cafe'/'other' by a keyword match on the
 * business-type field, since that dataset covers several licensed business
 * types in one feed rather than one per type).
 *
 * `facility_type='playground'` (야외 반려견 놀이터, used by
 * scoring-weighted.ts's dog-encounter-probability signal) is intentionally
 * NOT populated by this script — this project confirmed specific 서울시
 * 반려견 놀이터 examples exist (Seoul Open Data) during earlier research,
 * but never confirmed a *nationwide* standard endpoint for dog playgrounds
 * specifically, unlike the two sources below. Left for a follow-up ingest
 * script once that source is confirmed, rather than guessing at an
 * endpoint this project has no basis for.
 *
 * Hospitals: switched 2026-08-10 to a local file
 * (`jobs/ingest/data/animal-hospitals.csv`, Seoul + Yongin 행정안전부 인허가
 * 표준데이터 merged) instead of the OpenAPI — the odcloud endpoint this
 * project originally guessed was never confirmed, and the user already had
 * a real regional download on hand. This dataset's `좌표정보(X)`/`좌표정보(Y)`
 * fields are EPSG:5174 (중부원점 TM, Bessel ellipsoid — 행정안전부 인허가
 * 표준데이터's documented coordinate system, confirmed via web research), NOT
 * WGS84 lat/lon — reprojected via proj4 below, same technique as
 * ingest-road-segments.ts's node-link SHP (different CRS, same tool).
 *
 * Businesses (미용/카페): still API-based, endpoint unconfirmed — no file was
 * downloaded for this one, left as a best-effort guess.
 */

import { fetchAllGovDataItems, readField, readNumberField, type GovDataItem } from "./lib/gov-data-client.js";
import { readLocalDataFile } from "./lib/file-data-client.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";
import type { PetFacilityType } from "../../src/types/domain.js";
import proj4 from "proj4";

const HOSPITAL_SOURCE = "animal_hospital_registry";
const HOSPITAL_DATA_FILE = "animal-hospitals"; // jobs/ingest/data/animal-hospitals.csv — 행정안전부 동물병원 인허가정보 (Seoul+Yongin)

// EPSG:5174 (Korea 2000 / Unified CS, 중부원점 Bessel) — 행정안전부 인허가
// 표준데이터's documented X/Y coordinate system. towgs84 params are the
// standard Bessel-to-WGS84 (Tokyo datum shift) values for this EPSG code.
const KOREA_BESSEL_CENTRAL_PROJ4 =
  "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 " +
  "+ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";
const projectionToWgs84 = proj4(KOREA_BESSEL_CENTRAL_PROJ4, "WGS84");

function reprojectEpsg5174([x, y]: [number, number]): [number, number] {
  return projectionToWgs84.forward([x, y]) as [number, number];
}

const BUSINESS_SOURCE = "pet_business_registry";
const BUSINESS_ENDPOINT = "https://api.odcloud.kr/api/15045050/v1/uddi:pet-business"; // 반려동물 영업장 (미용/위탁관리 등)

type FacilityRow = {
  external_id: string | null;
  source: string;
  point: string;
  facility_type: PetFacilityType;
  name: string | null;
};

function extractPoint(item: GovDataItem): { lat: number; lon: number } | null {
  const lat = readNumberField(item, "위도", "lat", "latitude");
  const lon = readNumberField(item, "경도", "lon", "longitude");

  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}

function classifyBusinessType(rawType: string | undefined): PetFacilityType {
  if (!rawType) {
    return "other";
  }

  if (rawType.includes("미용")) {
    return "grooming";
  }

  if (rawType.includes("카페") || rawType.includes("휴게")) {
    return "cafe";
  }

  return "other";
}

async function ingestHospitals(): Promise<FacilityRow[]> {
  console.log("[ingest-pet-facilities] Reading 동물병원 인허가정보 from local file...");
  const items = await readLocalDataFile(HOSPITAL_DATA_FILE);
  console.log(`[ingest-pet-facilities] ${items.length} hospital records read.`);

  await clearBySource("pet_facilities", "source", HOSPITAL_SOURCE);

  const rows: FacilityRow[] = [];
  let skippedNoCoords = 0;
  let skippedClosed = 0;

  for (const item of items) {
    const x = readNumberField(item, "좌표정보(X)");
    const y = readNumberField(item, "좌표정보(Y)");

    if (x === null || y === null) {
      skippedNoCoords += 1;
      continue;
    }

    // 영업 중인 곳만: "영업상태"가 "영업/정상" 계열이 아니면 제외.
    const businessStatus = readField(item, "영업상태명", "business_status");
    if (businessStatus && !/영업|정상/.test(businessStatus)) {
      skippedClosed += 1;
      continue;
    }

    const [lon, lat] = reprojectEpsg5174([x, y]);

    rows.push({
      external_id: readField(item, "관리번호", "management_no") ?? null,
      source: HOSPITAL_SOURCE,
      point: toEwktPoint(lon, lat),
      facility_type: "hospital",
      name: readField(item, "사업장명", "business_name") ?? null
    });
  }

  console.log(
    `[ingest-pet-facilities] ${rows.length} hospital rows to insert ` +
      `(${skippedClosed} closed, ${skippedNoCoords} missing coordinates).`
  );

  return rows;
}

async function ingestBusinesses(): Promise<FacilityRow[]> {
  console.log("[ingest-pet-facilities] Fetching 반려동물 영업장...");
  const items = await fetchAllGovDataItems(BUSINESS_ENDPOINT);
  console.log(`[ingest-pet-facilities] ${items.length} business records fetched.`);

  await clearBySource("pet_facilities", "source", BUSINESS_SOURCE);

  const rows: FacilityRow[] = [];

  for (const item of items) {
    const point = extractPoint(item);

    if (!point) {
      continue;
    }

    const businessStatus = readField(item, "영업상태명", "business_status");
    if (businessStatus && !/영업|정상/.test(businessStatus)) {
      continue;
    }

    rows.push({
      external_id: readField(item, "관리번호", "management_no") ?? null,
      source: BUSINESS_SOURCE,
      point: toEwktPoint(point.lon, point.lat),
      facility_type: classifyBusinessType(readField(item, "업태구분명", "business_type")),
      name: readField(item, "사업장명", "business_name") ?? null
    });
  }

  return rows;
}

async function main(): Promise<void> {
  const hospitalRows = await ingestHospitals();

  // Business endpoint is still an unconfirmed guess (no downloaded file to
  // fall back on, unlike hospitals) — isolated so a 403/404 there doesn't
  // erase the confirmed, already-working hospital ingest.
  let businessRows: FacilityRow[] = [];
  try {
    businessRows = await ingestBusinesses();
  } catch (error) {
    console.error("[ingest-pet-facilities] Business ingest failed (endpoint unconfirmed), skipping:", error);
  }

  const allRows = [...hospitalRows, ...businessRows];

  console.log(`[ingest-pet-facilities] ${allRows.length} total rows to insert.`);

  const inserted = await insertInBatches("pet_facilities", allRows);
  console.log(`[ingest-pet-facilities] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-pet-facilities] Failed:", error);
  process.exitCode = 1;
});
