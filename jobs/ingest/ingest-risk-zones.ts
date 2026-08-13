/**
 * Ingests `risk_zones` (existing table, migration 0001) from
 * 전국교통사고다발지역표준데이터 (spec 4.1 #11), read from a locally
 * downloaded file at `jobs/ingest/data/risk-zones.csv` (or `.xlsx`) —
 * download the dataset from data.go.kr and save it there before running.
 * Each row represents a spot where 3+ qualifying accidents occurred within
 * a ~150m radius (per this project's earlier research on the dataset) —
 * stored as a Point with `type='accident'` and `severity` derived from the
 * accident count, clamped into risk_zones' 1-5 range.
 *
 * Run with: npm run ingest:risk-zones
 */

import { readField, readNumberField } from "./lib/gov-data-client.js";
import { readLocalDataFile } from "./lib/file-data-client.js";
import { clearBySource, insertInBatches } from "./lib/upsert-batch.js";
import { toEwktPoint } from "./lib/geo-format.js";

const SOURCE = "standard_data_accident_hotspots";
const DATA_FILE = "risk-zones"; // jobs/ingest/data/risk-zones.csv|xlsx — 전국교통사고다발지역표준데이터

function severityFromAccidentCount(accidentCount: number | null): number {
  if (accidentCount === null) {
    return 1;
  }

  // 3건(표준데이터 하한 기준) -> 1, 10건 이상 -> 5, 그 사이 선형 보간.
  const clamped = Math.max(3, Math.min(10, accidentCount));
  const severity = Math.round(1 + ((clamped - 3) / (10 - 3)) * 4);
  return Math.max(1, Math.min(5, severity));
}

async function main(): Promise<void> {
  console.log("[ingest-risk-zones] Reading 전국교통사고다발지역표준데이터 from local file...");
  const items = await readLocalDataFile(DATA_FILE);
  console.log(`[ingest-risk-zones] ${items.length} records read.`);

  await clearBySource("risk_zones", "source", SOURCE);

  const rows = [];
  let skipped = 0;

  for (const item of items) {
    const lat = readNumberField(item, "위도", "lat", "latitude");
    const lon = readNumberField(item, "경도", "lon", "longitude");

    if (lat === null || lon === null) {
      skipped += 1;
      continue;
    }

    const accidentCount = readNumberField(item, "사고건수", "accident_count");

    rows.push({
      type: "accident" as const,
      severity: severityFromAccidentCount(accidentCount),
      source: SOURCE,
      description: readField(item, "사고지역위치명", "지점명", "발생지역시도", "location_name") ?? null,
      geom: toEwktPoint(lon, lat)
    });
  }

  console.log(`[ingest-risk-zones] ${rows.length} rows to insert (${skipped} skipped for missing coordinates).`);

  const inserted = await insertInBatches("risk_zones", rows);
  console.log(`[ingest-risk-zones] Done: ${inserted} rows inserted.`);
}

main().catch((error) => {
  console.error("[ingest-risk-zones] Failed:", error);
  process.exitCode = 1;
});
