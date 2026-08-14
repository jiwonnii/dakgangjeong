/**
 * Thin HTTP client for a self-hosted GraphHopper instance's `POST /route`
 * endpoint, used with `algorithm=round_trip` and a per-request custom
 * model (spec 5.4).
 *
 * 실측 확인 (GraphHopper 클라우드 API, 무료 플랜):
 *   - POST body가 GET 쿼리 파라미터 이름을 그대로 쓰는 것, 즉 dotted
 *     `round_trip.*` 키를 평범한 JSON 키로 보내는 방식이 동작한다.
 *   - `points`와 응답 `points` 좌표는 `[lon, lat]` (GeoJSON 순서)이고
 *     `points_encoded=false`와 일관된다.
 *   - `algorithm=round_trip`과 `custom_model` 모두 무료 플랜에서 적용된다
 *     (custom model을 바꾸면 반환 경로가 실제로 달라지는 것으로 확인).
 *   - 단 `ch.disable: true`를 함께 보내면 무료 플랜에서 400
 *     "Free packages cannot use flexible mode"로 거절된다. 셀프호스팅에서는
 *     반대로 custom model에 이 플래그가 필요하다 — buildRequestBody 참고.
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
  const body: Record<string, unknown> = {
    points: [[request.origin.lon, request.origin.lat]],
    profile: request.profile,
    algorithm: "round_trip",
    "round_trip.distance": request.distanceMeters,
    "round_trip.seed": request.seed,
    heading: [request.headingDegrees],
    "custom_model": request.customModel,
    points_encoded: false,
    instructions: false,
    elevation: false
  };

  // 셀프호스팅에서는 custom model을 쓰려면 CH를 꺼야 한다(5.4 제약 1). 반면
  // GraphHopper 클라우드 API는 같은 플래그를 flexible mode 요청으로 보고
  // 무료 플랜에서 400 "Free packages cannot use flexible mode"로 거절한다.
  // 클라우드에서도 custom model과 round_trip은 이 플래그 없이 적용된다(실측
  // 확인). API key 유무로 두 환경을 구분한다.
  if (!env.GRAPHHOPPER_API_KEY) {
    body["ch.disable"] = true;
  }

  return body;
}

function buildRouteUrl(): string {
  const baseUrl = env.GRAPHHOPPER_URL.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/route`);

  if (env.GRAPHHOPPER_API_KEY) {
    url.searchParams.set("key", env.GRAPHHOPPER_API_KEY);
  }

  return url.toString();
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
