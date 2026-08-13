/**
 * Reads a locally downloaded 공공데이터포털 표준데이터 file (CSV, XLSX, or
 * legacy binary XLS) and returns rows in the same shape ingest scripts
 * already consume via gov-data-client's GovDataItem (Record<string,
 * unknown>) — so readField/readNumberField work unchanged regardless of
 * whether a row came from the live OpenAPI or a downloaded file.
 *
 * Introduced because 7 of this project's 표준데이터 sources (가로수,
 * 보안등, 보행자전용/우선도로, 스쿨존, 과속방지턱, 사고다발지역) don't
 * change often enough to justify chasing down each dataset's OpenAPI auth
 * quirks — a one-time file download is faster and just as correct. (공원
 * is the one exception — no file-download option exists for it, so
 * ingest-parks.ts still calls the OpenAPI directly.)
 *
 * 공공데이터포털 CSV downloads are frequently EUC-KR/CP949 encoded, not
 * UTF-8. Detected here by attempting a strict UTF-8 decode first and
 * falling back to CP949 if that throws — invalid CP949 byte sequences are
 * very likely to also be invalid UTF-8, making this a reliable signal for
 * this data source without needing a full encoding-detection library.
 *
 * .xls (legacy BIFF/OLE2 binary, not Open XML) is read via the `xlsx`
 * (SheetJS) package rather than `exceljs`, which only understands modern
 * .xlsx. `xlsx`'s npm-published build has known unpatched CVEs (prototype
 * pollution, ReDoS) — an accepted risk here since it only ever parses
 * files the user downloaded themselves from data.go.kr, never
 * attacker-supplied input. Genuine .xlsx still goes through `exceljs`,
 * which has no such advisory.
 */

import fs from "node:fs";
import path from "node:path";
import iconv from "iconv-lite";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import XLSX from "xlsx"; // default import — xlsx's ESM named exports omit readFile/readFileSync under Node
import { AppError } from "../../../src/lib/app-error.js";
import type { GovDataItem } from "./gov-data-client.js";

export const INGEST_DATA_DIR = path.resolve(process.cwd(), "jobs/ingest/data");

function decodeCsvBuffer(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(buffer, "cp949");
  }
}

function readCsvFile(filePath: string): GovDataItem[] {
  const buffer = fs.readFileSync(filePath);
  const text = decodeCsvBuffer(buffer);

  return parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  }) as GovDataItem[];
}

async function readXlsxFile(filePath: string): Promise<GovDataItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: GovDataItem[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return; // header row
    }

    const item: GovDataItem = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        item[header] = cell.value instanceof Object && "text" in cell.value
          ? (cell.value as { text: string }).text
          : cell.value;
      }
    });

    rows.push(item);
  });

  return rows;
}

function readXlsFile(filePath: string): GovDataItem[] {
  const workbook = XLSX.readFile(filePath, { codepage: 949 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    return [];
  }

  // 공공데이터포털's .xls export template leaves row 1 entirely blank (a
  // merged title cell) with the real header on row 2 — observed on every
  // 표준데이터 .xls file downloaded for this project so far. Detected here
  // rather than hardcoded so a file that DOES have its header on row 1
  // still parses correctly.
  const firstRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0 })[0] ?? [];
  const firstRowIsBlank = firstRow.every((cell) => cell === null || cell === undefined || cell === "");
  const range = firstRowIsBlank ? 1 : 0;

  return XLSX.utils.sheet_to_json<GovDataItem>(sheet, { defval: null, raw: true, range });
}

/**
 * Reads `jobs/ingest/data/<baseName>.csv`, `.xlsx`, or `.xls` — whichever
 * exists — so each ingest script names the dataset once and the user can
 * download any of the three formats data.go.kr offers. Throws a clear
 * AppError naming the expected paths if none is present yet, instead of a
 * raw ENOENT.
 */
export async function readLocalDataFile(baseName: string): Promise<GovDataItem[]> {
  const csvPath = path.join(INGEST_DATA_DIR, `${baseName}.csv`);
  const xlsxPath = path.join(INGEST_DATA_DIR, `${baseName}.xlsx`);
  const xlsPath = path.join(INGEST_DATA_DIR, `${baseName}.xls`);

  if (fs.existsSync(csvPath)) {
    return readCsvFile(csvPath);
  }

  if (fs.existsSync(xlsxPath)) {
    return readXlsxFile(xlsxPath);
  }

  if (fs.existsSync(xlsPath)) {
    return readXlsFile(xlsPath);
  }

  throw new AppError(
    `No local data file found for "${baseName}". Expected ${csvPath}, ${xlsxPath}, or ${xlsPath} — ` +
      `download the dataset from data.go.kr and save it there.`,
    500,
    "LOCAL_DATA_FILE_MISSING"
  );
}
