/**
 * Pure geometry helpers shared across the walk-recommendation pipeline:
 * bearing/distance math (spec 5.3), grid quantization for caching
 * (spec 5.3 "격자 200m 단위", 7.3 캐시 키), and coarse radius checks
 * (spec 2 서비스 지역).
 *
 * Every function here is pure and synchronous — no I/O, no PostGIS. The
 * PostGIS equivalents (ST_DWithin, ST_Length, ...) do the same job over
 * real geometry columns; these are for the small amount of math the
 * application layer needs before/around those queries.
 */

import type { BearingBin } from "../types/domain";
import { BEARING_BIN_COUNT, BEARING_BIN_WIDTH_DEGREES } from "../constants/walk-tuning";

export type LatLon = {
  lat: number;
  lon: number;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Great-circle distance between two points, in meters (haversine). */
export function haversineDistanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_M * c;
}

/** Initial compass bearing from `from` to `to`, normalized to [0, 360). */
export function calculateBearingDegrees(from: LatLon, to: LatLon): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return normalizeBearingDegrees(toDegrees(Math.atan2(y, x)));
}

/** Wraps any bearing value into [0, 360). */
export function normalizeBearingDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Classifies a bearing into one of the 8 compass bins used throughout the
 * pipeline (spec 5.3): 0=북(0°) 1=북동(45°) 2=동(90°) 3=남동(135°)
 * 4=남(180°) 5=남서(225°) 6=서(270°) 7=북서(315°). Each bin is centered on
 * its own angle and spans ±22.5°.
 */
export function bearingDegreesToBin(degrees: number): BearingBin {
  const normalized = normalizeBearingDegrees(degrees);
  const bin = Math.round(normalized / BEARING_BIN_WIDTH_DEGREES) % BEARING_BIN_COUNT;
  return bin as BearingBin;
}

/** Inverse of bearingDegreesToBin: the exact center angle of a bin, matching
 * the spec 5.3 table (bin index × 45° = the bin's compass angle). */
export function bearingBinToCenterDegrees(bin: BearingBin): number {
  return bin * BEARING_BIN_WIDTH_DEGREES;
}

export const BEARING_BIN_LABELS_KO: Readonly<Record<BearingBin, string>> = {
  0: "북",
  1: "북동",
  2: "동",
  3: "남동",
  4: "남",
  5: "남서",
  6: "서",
  7: "북서"
};

/**
 * Projects a destination point from `origin` given a bearing and distance,
 * using the standard spherical direct geodesic formula. Not used to drive
 * GraphHopper (which performs its own waypoint projection internally for
 * `round_trip`), but useful for coverage checks and grid math that need a
 * concrete point rather than just a bearing.
 */
export function destinationPoint(
  origin: LatLon,
  bearingDegrees: number,
  distanceMeters: number
): LatLon {
  const angularDistance = distanceMeters / EARTH_RADIUS_M;
  const bearingRad = toRadians(bearingDegrees);
  const lat1 = toRadians(origin.lat);
  const lon1 = toRadians(origin.lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDegrees(lat2),
    lon: toDegrees(lon2)
  };
}

/** True if `point` is within `radiusMeters` of `center` (haversine, not
 * geodesic-exact, which is more than accurate enough at city scale). */
export function isWithinRadiusMeters(
  center: LatLon,
  point: LatLon,
  radiusMeters: number
): boolean {
  return haversineDistanceMeters(center, point) <= radiusMeters;
}

const METERS_PER_DEGREE_LATITUDE = 111320;

/**
 * Quantizes a point onto a square grid of `cellSizeMeters` and returns a
 * stable string key for that cell. Longitude step is widened by
 * `1 / cos(lat)` so cells stay approximately square at any latitude — at
 * Seoul/Yongin's latitude (~37.3-37.6°N) that factor is roughly 1.26.
 *
 * Used for: bearing_grid precomputation (spec 5.3, 200m cells) and the
 * recommendation cache key (spec 7.3, "격자좌표 + 강아지ID + ...").
 */
export function gridKeyForPoint(point: LatLon, cellSizeMeters: number): string {
  const latStepDegrees = cellSizeMeters / METERS_PER_DEGREE_LATITUDE;
  const lonStepDegrees =
    cellSizeMeters / (METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(point.lat)));

  const latCellIndex = Math.floor(point.lat / latStepDegrees);
  const lonCellIndex = Math.floor(point.lon / lonStepDegrees);

  return `${cellSizeMeters}:${latCellIndex}:${lonCellIndex}`;
}

/**
 * Inverse of gridKeyForPoint: returns the center point of the cell a key
 * refers to. Used when persisting bearing_grid rows, which store
 * center_lat/center_lon alongside the grid_key for downstream spatial
 * queries.
 */
export function gridCellCenter(gridKey: string): LatLon {
  const [cellSizeRaw, latIndexRaw, lonIndexRaw] = gridKey.split(":");
  const cellSizeMeters = Number(cellSizeRaw);
  const latIndex = Number(latIndexRaw);
  const lonIndex = Number(lonIndexRaw);

  if (
    !Number.isFinite(cellSizeMeters) ||
    !Number.isFinite(latIndex) ||
    !Number.isFinite(lonIndex)
  ) {
    throw new Error(`Invalid grid key: ${gridKey}`);
  }

  const latStepDegrees = cellSizeMeters / METERS_PER_DEGREE_LATITUDE;
  const approxCenterLat = (latIndex + 0.5) * latStepDegrees;
  const lonStepDegrees =
    cellSizeMeters / (METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(approxCenterLat)));

  return {
    lat: (latIndex + 0.5) * latStepDegrees,
    lon: (lonIndex + 0.5) * lonStepDegrees
  };
}

/**
 * Enumerates every canonical grid cell (per gridKeyForPoint/gridCellCenter)
 * whose center falls within `radiusMeters` of `center`, at `cellSizeMeters`
 * spacing. Used by the bearing_grid precompute batch (spec 7.3, "배치
 * 처리: ... 격자별 방위 분포") to cover the service area without issuing
 * one query per candidate cell — callers pass the returned cell centers
 * into a single batched spatial query instead.
 */
export function enumerateGridCellsInRadius(
  center: LatLon,
  radiusMeters: number,
  cellSizeMeters: number
): LatLon[] {
  const latStepDegrees = cellSizeMeters / METERS_PER_DEGREE_LATITUDE;
  const latRadiusDegrees = radiusMeters / METERS_PER_DEGREE_LATITUDE;
  const lonRadiusDegrees = radiusMeters / (METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(center.lat)));

  const seenGridKeys = new Set<string>();
  const cells: LatLon[] = [];

  const minLat = center.lat - latRadiusDegrees;
  const maxLat = center.lat + latRadiusDegrees;
  const minLon = center.lon - lonRadiusDegrees;
  const maxLon = center.lon + lonRadiusDegrees;

  for (let lat = minLat; lat <= maxLat; lat += latStepDegrees) {
    const lonStepDegrees = cellSizeMeters / (METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(lat)));

    for (let lon = minLon; lon <= maxLon; lon += lonStepDegrees) {
      const candidate = { lat, lon };
      const gridKey = gridKeyForPoint(candidate, cellSizeMeters);

      if (seenGridKeys.has(gridKey)) {
        continue;
      }

      const cellCenter = gridCellCenter(gridKey);

      if (haversineDistanceMeters(center, cellCenter) <= radiusMeters) {
        seenGridKeys.add(gridKey);
        cells.push(cellCenter);
      }
    }
  }

  return cells;
}
