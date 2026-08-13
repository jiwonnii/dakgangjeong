/**
 * Orchestrates 코스 생성 (spec 5.4): builds the per-dog custom model
 * (fetching nearby parks first if needed), then requests 6 round_trip
 * candidates from GraphHopper (3 bearings × 2 seeds) in parallel. A single
 * candidate failing (GraphHopper couldn't satisfy that heading/seed
 * combination) does not fail the whole request — the caller gets back
 * whatever candidates succeeded plus a record of what failed, and can
 * still proceed as long as at least one candidate exists.
 */

import { getSupabaseAdminClient } from "../../../lib/supabase";
import { AppError } from "../../../lib/app-error";
import { requestRoundTripRoute } from "../../../lib/graphhopper-client";
import type { LatLon } from "../../../lib/geo";
import {
  GRAPHHOPPER_FOOT_PROFILE_NAME,
  PARK_SEARCH_RADIUS_MAX_M,
  PARK_SEARCH_RADIUS_RATIO,
  ROUTE_SEEDS_PER_BEARING
} from "../../../constants/walk-tuning";
import { buildCustomModel, type NearbyParkArea } from "../domain/custom-model";
import type { SelectedBearing } from "../domain/bearing-selection";
import type { DogProfile } from "../domain/dog-profile";

export type RouteCandidate = {
  bearing: SelectedBearing;
  seed: number;
  distanceMeters: number;
  timeMs: number;
  points: LatLon[];
};

export type RouteGenerationFailure = {
  bearing: SelectedBearing;
  seed: number;
  reason: string;
};

export type RouteGenerationResult = {
  candidates: RouteCandidate[];
  failures: RouteGenerationFailure[];
};

type ParkPolygonRow = {
  park_id: string;
  polygon_geojson: { type: string; coordinates: number[][][] } | null;
};

function resolveSeedsPerBearing(profile: DogProfile, randomizeSeeds: boolean): number[] {
  // 모험적인 성격은 늘 새 길을, "다시 추천받기"(randomizeSeeds)는 이번 한 번만
  // 새 길을 원한다. 둘 다 시드를 새로 뽑아야 GraphHopper 가 다른 코스를 준다.
  if (!profile.personality.isAdventurous && !randomizeSeeds) {
    return [...ROUTE_SEEDS_PER_BEARING];
  }

  return ROUTE_SEEDS_PER_BEARING.map(() => Math.floor(Math.random() * 1_000_000_000));
}

async function fetchNearbyParkAreas(
  origin: LatLon,
  targetDistanceMeters: number
): Promise<NearbyParkArea[]> {
  const radiusMeters = Math.min(
    targetDistanceMeters * PARK_SEARCH_RADIUS_RATIO,
    PARK_SEARCH_RADIUS_MAX_M
  );

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("find_nearby_park_polygons", {
    origin_lon: origin.lon,
    origin_lat: origin.lat,
    radius_m: radiusMeters
  });

  if (error) {
    throw new AppError(error.message, 500, "PARK_LOOKUP_FAILED");
  }

  const rows = (data ?? []) as ParkPolygonRow[];

  return rows
    .filter((row) => row.polygon_geojson?.type === "Polygon")
    .map((row) => ({
      id: row.park_id,
      ringCoordinates: row.polygon_geojson!.coordinates
    }));
}

/**
 * @param bearings Output of bearing-selection.ts's selectTopBearings —
 *   already filtered/sorted, may contain fewer than 3 entries in a
 *   low-density area (spec 5.7).
 */
export async function generateRouteCandidates(
  origin: LatLon,
  targetDistanceMeters: number,
  bearings: readonly SelectedBearing[],
  profile: DogProfile,
  now: Date,
  options: { randomizeSeeds?: boolean } = {}
): Promise<RouteGenerationResult> {
  const nearbyParks = profile.personality.prefersParks
    ? await fetchNearbyParkAreas(origin, targetDistanceMeters)
    : [];

  const customModel = buildCustomModel(profile, now, nearbyParks);

  const seedsPerBearing = resolveSeedsPerBearing(profile, Boolean(options.randomizeSeeds));
  const requests = bearings.flatMap((bearing) =>
    seedsPerBearing.map((seed) => ({ bearing, seed }))
  );

  const settled = await Promise.allSettled(
    requests.map(({ bearing, seed }) =>
      requestRoundTripRoute({
        origin,
        distanceMeters: targetDistanceMeters,
        headingDegrees: bearing.degrees,
        seed,
        customModel,
        profile: GRAPHHOPPER_FOOT_PROFILE_NAME
      })
    )
  );

  const candidates: RouteCandidate[] = [];
  const failures: RouteGenerationFailure[] = [];

  settled.forEach((outcome, index) => {
    const { bearing, seed } = requests[index];

    if (outcome.status === "fulfilled") {
      candidates.push({
        bearing,
        seed,
        distanceMeters: outcome.value.distanceMeters,
        timeMs: outcome.value.timeMs,
        points: outcome.value.points
      });
      return;
    }

    const reason =
      outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);

    failures.push({ bearing, seed, reason });
  });

  return { candidates, failures };
}
