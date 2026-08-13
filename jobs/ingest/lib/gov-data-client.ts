/**
 * Shared paginated fetcher for 공공데이터포털 OpenAPI endpoints (spec 4.1).
 * Every dataset in spec 4.1 rows 3-16 shares the same data.go.kr response
 * envelope this project already confirmed against a real endpoint in
 * weather.provider.ts / air-quality.provider.ts:
 *
 *   { response: { header: { resultCode, resultMsg }, body: { items, ... } } }
 *
 * `items` itself varies in shape across endpoint families — some (KMA
 * getVilageFcst) nest as `{ item: [...] }`, others (많은 표준데이터
 * OpenAPI) return the array directly as `items: [...]`. This client
 * normalizes both.
 *
 * VERIFICATION CAVEAT (see round-11 report): the envelope shape above is
 * confirmed (same family used successfully elsewhere in this project).
 * The per-dataset *item field names* (Korean column headers) used by each
 * ingest-*.ts script are this project's best-effort reading of each
 * dataset's publicly documented column list, not a response this session
 * has actually received — cross-check the first live page of each
 * dataset against its 공공데이터포털 문서 sample response before trusting
 * the transformed output.
 */

import { AppError } from "../../../src/lib/app-error.js";
import { env } from "../../../src/config/env.js";

export type GovDataItem = Record<string, unknown>;

function requirePublicDataApiKey(): string {
  if (!env.PUBLIC_DATA_API_KEY) {
    throw new AppError(
      "PUBLIC_DATA_API_KEY is not configured.",
      500,
      "PUBLIC_DATA_API_KEY_MISSING"
    );
  }

  return env.PUBLIC_DATA_API_KEY;
}

type GovDataResponseBody = {
  header: { resultCode: string; resultMsg: string };
  body?: {
    items?: GovDataItem[] | { item: GovDataItem[] | GovDataItem };
    totalCount?: number;
    numOfRows?: number;
    pageNo?: number;
  };
};

// Two envelope generations exist on data.go.kr: the older `uddi:`/getVilageFcst
// family wraps everything in a top-level `response` key; the newer
// `tn_pubr_...` family (e.g. 전국도시공원정보표준데이터's real endpoint,
// confirmed 2026-08-10) returns `header`/`body` directly at the top level with
// no `response` wrapper. Both are accepted here rather than picking one, since
// there's no way to know in advance which family a given dataset uses.
type GovDataEnvelope = { response: GovDataResponseBody } | GovDataResponseBody;

function unwrapEnvelope(payload: GovDataEnvelope): GovDataResponseBody {
  return "response" in payload ? payload.response : payload;
}

function normalizeItems(
  items: GovDataItem[] | { item: GovDataItem[] | GovDataItem } | undefined
): GovDataItem[] {
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items;
  }

  if (Array.isArray(items.item)) {
    return items.item;
  }

  return items.item ? [items.item] : [];
}

export type FetchAllOptions = {
  /** Extra query params specific to this dataset (beyond serviceKey/
   * pageNo/numOfRows/dataType, which this client always sets). */
  extraParams?: Record<string, string>;
  itemsPerPage?: number;
  /** Some datasets use `dataType=JSON`, others `type=json` — data.go.kr is
   * not consistent across API generations. Defaults to both being set,
   * which is harmless (the unused one is just ignored server-side) unless
   * a specific dataset's docs say otherwise. */
  dataTypeParamName?: "dataType" | "type";
};

/**
 * Fetches every page of a data.go.kr OpenAPI endpoint and returns the
 * concatenated, normalized item list. Stops when a page returns fewer
 * items than requested, or once `totalCount` (when present) is reached —
 * whichever the server tells us first.
 */
export async function fetchAllGovDataItems(
  endpoint: string,
  options: FetchAllOptions = {}
): Promise<GovDataItem[]> {
  const apiKey = requirePublicDataApiKey();
  const itemsPerPage = options.itemsPerPage ?? 1000;
  const dataTypeParamName = options.dataTypeParamName ?? "type";

  const allItems: GovDataItem[] = [];
  let pageNo = 1;

  while (true) {
    const url = new URL(endpoint);
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(itemsPerPage));
    url.searchParams.set(dataTypeParamName, "json");

    for (const [key, value] of Object.entries(options.extraParams ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new AppError(
        `Request to ${endpoint} failed with status ${response.status} (page ${pageNo}).`,
        502,
        "GOV_DATA_REQUEST_FAILED"
      );
    }

    const rawPayload = (await response.json()) as GovDataEnvelope;
    const payload = unwrapEnvelope(rawPayload);

    if (payload.header.resultCode !== "00") {
      throw new AppError(
        `${endpoint} returned an error: ${payload.header.resultMsg} (page ${pageNo}).`,
        502,
        "GOV_DATA_API_ERROR",
        payload.header
      );
    }

    const pageItems = normalizeItems(payload.body?.items);
    allItems.push(...pageItems);

    const totalCount = payload.body?.totalCount;

    if (pageItems.length === 0) {
      break;
    }

    if (typeof totalCount === "number" && allItems.length >= totalCount) {
      break;
    }

    if (pageItems.length < itemsPerPage) {
      break;
    }

    pageNo += 1;
  }

  return allItems;
}

/** Reads a field from a GovDataItem, trying each candidate key in order —
 * useful because some 표준데이터 datasets have been observed to vary a
 * column's exact header slightly (e.g. "위도" vs "위도(WGS84)") across
 * provider updates. Returns undefined if none match. */
export function readField(item: GovDataItem, ...candidateKeys: string[]): string | undefined {
  for (const key of candidateKeys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return undefined;
}

export function readNumberField(item: GovDataItem, ...candidateKeys: string[]): number | null {
  const raw = readField(item, ...candidateKeys);

  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
