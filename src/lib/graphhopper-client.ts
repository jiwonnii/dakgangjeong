/**
 * Thin HTTP client for a self-hosted GraphHopper instance's `POST /route`
 * endpoint, used with `algorithm=round_trip` and a per-request custom
 * model (spec 5.4).
 *
 * VERIFICATION CAVEAT: this project has not made a live call against a
 * running GraphHopper instance (none was available while writing this).
 * The request/response shapes below follow GraphHopper's documented
 * conventions as researched during spec design:
 *   - POST body mirrors the GET query parameter names, including the
 *     dotted `round_trip.*` and `ch.disable` keys, as plain JSON keys.
 *   - `points` and response `points` coordinates are `[lon, lat]`
 *     (GeoJSON order), consistent with `points_encoded=false`.
 *   - Custom models require `ch.disable: true` (5.4 제약 1) and only work
 *     via POST (5.4 제약 2).
 * Cross-check these against a real instance's response before relying on
 * this in production — see the round-6 report for exactly what to verify
 * first.
 */

import { AppError } from "./app-error";
import { env } from "../config/env";
import type { LatLon } from "./geo";

export type GraphHopperPriorityStatement = {
  if?: string;
  else_if?: string;
  else?: "";
  multiply_by?: number;
  limit_to?: number;
};

export type GraphHopperAreaFeature = {
  id: string;
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: {
    type: "Polygon";
    /** Rings of [lon, lat] pairs; each ring's first and last point must be
     * identical (spec 5.4 제약 3). */
    coordinates: number[][][];
  };
};

export type GraphHopperCustomModel = {
  priority?: GraphHopperPriorityStatement[];
  speed?: GraphHopperPriorityStatement[];
  distance_influence?: number;
  areas?: {
    type: "FeatureCollection";
    features: GraphHopperAreaFeature[];
  };
};

export type RoundTripRequest = {
  origin: LatLon;
  distanceMeters: number;
  headingDegrees: number;
  seed: number;
  customModel: GraphHopperCustomModel;
  profile: string;
};

export type GraphHopperPath = {
  distanceMeters: number;
  timeMs: number;
  /** Decoded route geometry, in [lat, lon] application order (this client
   * converts from GraphHopper's [lon, lat] wire format immediately so
   * nothing downstream has to remember which order applies where). */
  points: LatLon[];
};

type RawGraphHopperResponse = {
  paths?: Array<{
    distance: number;
    time: number;
    points: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
  message?: string;
  hints?: Array<{ message: string }>;
};

function buildRequestBody(request: RoundTripRequest): Record<string, unknown> {
  return {
    points: [[request.origin.lon, request.origin.lat]],
    profile: request.profile,
    algorithm: "round_trip",
    "round_trip.distance": request.distanceMeters,
    "round_trip.seed": request.seed,
    heading: [request.headingDegrees],
    "ch.disable": true,
    "custom_model": request.customModel,
    points_encoded: false,
    instructions: false,
    elevation: false
  };
}

function buildRouteUrl(): string {
  const baseUrl = env.GRAPHHOPPER_URL.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/route`);

  if (env.GRAPHHOPPER_API_KEY) {
    url.searchParams.set("key", env.GRAPHHOPPER_API_KEY);
  }

  return url.toString();
}

/**
 * Requests a single round-trip route. Throws AppError on any GraphHopper
 * error (non-2xx status, or a 2xx response with no usable path — e.g. the
 * requested distance could not be satisfied from this origin/heading after
 * GraphHopper's internal retries, per spec 5.4 round_trip 동작 step 2).
 */
export async function requestRoundTripRoute(request: RoundTripRequest): Promise<GraphHopperPath> {
  const url = buildRouteUrl();

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(request))
    });
  } catch (cause) {
    throw new AppError(
      `Failed to reach GraphHopper at ${env.GRAPHHOPPER_URL}.`,
      502,
      "GRAPHHOPPER_UNREACHABLE",
      cause
    );
  }

  const payload = (await response.json().catch(() => null)) as RawGraphHopperResponse | null;

  if (!response.ok) {
    const message =
      payload?.message ?? payload?.hints?.map((hint) => hint.message).join("; ") ?? "unknown error";

    throw new AppError(
      `GraphHopper round_trip request failed (${response.status}): ${message}`,
      502,
      "GRAPHHOPPER_REQUEST_FAILED",
      payload
    );
  }

  const path = payload?.paths?.[0];

  if (!path) {
    throw new AppError(
      "GraphHopper returned no usable path for this round_trip request.",
      502,
      "GRAPHHOPPER_NO_PATH"
    );
  }

  return {
    distanceMeters: path.distance,
    timeMs: path.time,
    points: path.points.coordinates.map(([lon, lat]) => ({ lat, lon }))
  };
}
