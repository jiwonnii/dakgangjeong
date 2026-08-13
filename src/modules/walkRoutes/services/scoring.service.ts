/**
 * I/O layer for 사후 채점 (spec 5.5): turns generated route candidates into
 * measurable facts via a single batched PostGIS RPC call, plus the
 * once-per-request origin context (dong-level dog density) that all
 * candidates share.
 *
 * This module only collects raw facts — it does not decide what a "good"
 * score is. Combining these facts into rankings (계층 필터 / 3축 가중치)
 * is round 9's job (scoring-filter.ts / scoring-weighted.ts), which reads
 * the `CourseFacts` this module produces.
 */

import { getSupabaseAdminClient } from "../../../lib/supabase";
import { AppError } from "../../../lib/app-error";
import type { LatLon } from "../../../lib/geo";
import {
  BENCH_SEARCH_RADIUS_M,
  DIVERSITY_CORRIDOR_WIDTH_M,
  DIVERSITY_LOOKBACK_DAYS,
  PET_FACILITY_SEARCH_RADIUS_M,
  ROAD_SEGMENT_MATCH_BUFFER_M,
  TREE_SEARCH_RADIUS_M
} from "../../../constants/walk-tuning";
import type { RouteCandidate } from "./route-generation.service";

export type CourseFacts = {
  bearing: RouteCandidate["bearing"];
  seed: number;
  distanceMeters: number;
  timeMs: number;
  points: LatLon[];
  treesPerKm: number;
  parkRatio: number;
  riskZoneCount: number;
  benchCount: number;
  petFacilityCountNearby: number;
  diversityOverlapRatio: number;
  /** Null when no road_segments rows matched near this path (ingest gap) —
   * see migration 0006's comment. scoring-filter.ts (round 9) decides the
   * fallback treatment, not this layer. */
  vehicleExposureAvg: number | null;
  /** Count of road_segments classified 'steps' near this path — safety net
   * for the 1차 필터's stair exclusion (spec 5.6). See migration 0006. */
  stepsCount: number;
};

export type OriginContext = {
  dongCode: string | null;
  dongDensityPerSqkm: number | null;
};

function pointsToGeoJsonLineString(points: readonly LatLon[]): string {
  const coordinates = points.map((point) => [point.lon, point.lat]);
  return JSON.stringify({ type: "LineString", coordinates });
}

/**
 * Reads the registered-dog density of the 읍면동 containing `origin`, once
 * per recommendation request (all 6 candidates share the same origin, so
 * this is deliberately not part of the per-candidate batch RPC).
 */
export async function fetchOriginContext(origin: LatLon): Promise<OriginContext> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc("find_dong_density_at_point", {
    origin_lon: origin.lon,
    origin_lat: origin.lat
  });

  if (error) {
    throw new AppError(error.message, 500, "DONG_DENSITY_LOOKUP_FAILED");
  }

  const row = (data ?? [])[0] as { dong_code: string; density_per_sqkm: number } | undefined;

  return {
    dongCode: row?.dong_code ?? null,
    dongDensityPerSqkm: row?.density_per_sqkm ?? null
  };
}

type ScoreRow = {
  cell_index: number;
  length_m: number;
  trees_per_km: number;
  park_ratio: number;
  risk_zone_count: number;
  bench_count: number;
  pet_facility_count: number;
  diversity_overlap_ratio: number;
  vehicle_exposure_avg: number | null;
  steps_count: number;
};

/**
 * Scores every candidate in one RPC round trip. Returns facts in the same
 * order as `candidates`; a candidate whose row is missing from the RPC
 * response (should not normally happen) is dropped rather than returned
 * with fabricated values.
 */
export async function scoreRouteCandidates(
  candidates: readonly RouteCandidate[],
  dogId: string
): Promise<CourseFacts[]> {
  if (candidates.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc("score_route_candidates", {
    candidate_indices: candidates.map((_, index) => index),
    candidate_paths_geojson: candidates.map((candidate) =>
      pointsToGeoJsonLineString(candidate.points)
    ),
    dog_id_param: dogId,
    tree_radius_m: TREE_SEARCH_RADIUS_M,
    bench_radius_m: BENCH_SEARCH_RADIUS_M,
    pet_facility_radius_m: PET_FACILITY_SEARCH_RADIUS_M,
    diversity_corridor_width_m: DIVERSITY_CORRIDOR_WIDTH_M,
    diversity_lookback_days: DIVERSITY_LOOKBACK_DAYS,
    road_match_buffer_m: ROAD_SEGMENT_MATCH_BUFFER_M
  });

  if (error) {
    throw new AppError(error.message, 500, "ROUTE_SCORING_FAILED");
  }

  const rowsByIndex = new Map<number, ScoreRow>(
    ((data ?? []) as ScoreRow[]).map((row) => [row.cell_index, row])
  );

  const facts: CourseFacts[] = [];

  candidates.forEach((candidate, index) => {
    const row = rowsByIndex.get(index);

    if (!row) {
      return;
    }

    facts.push({
      bearing: candidate.bearing,
      seed: candidate.seed,
      distanceMeters: candidate.distanceMeters,
      timeMs: candidate.timeMs,
      points: candidate.points,
      treesPerKm: row.trees_per_km,
      parkRatio: row.park_ratio,
      riskZoneCount: row.risk_zone_count,
      benchCount: row.bench_count,
      petFacilityCountNearby: row.pet_facility_count,
      diversityOverlapRatio: row.diversity_overlap_ratio,
      vehicleExposureAvg: row.vehicle_exposure_avg,
      stepsCount: row.steps_count
    });
  });

  return facts;
}
