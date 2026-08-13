/**
 * Converts WGS84 latitude/longitude into the TM (Transverse Mercator)
 * coordinates required by 에어코리아's 근접측정소 조회 API, per spec 4.1
 * note 3: "에어코리아 근접측정소 조회는 TM 좌표를 요구함."
 *
 * 에어코리아 uses GRS80 중부원점 TM — the projection published as EPSG:5181
 * ("Korea 2000 / Central Belt"): GRS80 ellipsoid, central meridian 127°E,
 * origin latitude 38°N, scale factor 1.0, false easting 200000m, false
 * northing 500000m. The forward projection below is Snyder's standard
 * ellipsoidal Transverse Mercator series (Snyder, "Map Projections: A
 * Working Manual", 1987, eqs. 8-9 to 8-11) — the same formula UTM and every
 * other TM-family projection is built on, parameterized for EPSG:5181.
 *
 * IMPORTANT: this has not been validated against a live 에어코리아 response
 * (no API key yet — spec 4.1 note 1). Cross-check the first few real
 * `tmX`/`tmY` lookups against 공식 샘플코드 or a known station's published
 * TM coordinate once the key is issued, per the project's honesty norm of
 * flagging unverified external-format assumptions rather than silently
 * trusting them.
 */

export type TmCoordinate = {
  tmX: number;
  tmY: number;
};

// GRS80 ellipsoid parameters.
const SEMI_MAJOR_AXIS_M = 6378137.0;
const FLATTENING = 1 / 298.257222101;

// EPSG:5181 "Korea 2000 / Central Belt" projection parameters.
const CENTRAL_MERIDIAN_DEG = 127.0;
const ORIGIN_LATITUDE_DEG = 38.0;
const SCALE_FACTOR = 1.0;
const FALSE_EASTING_M = 200000.0;
const FALSE_NORTHING_M = 500000.0;

const DEG_TO_RAD = Math.PI / 180.0;

const eccentricitySquared = FLATTENING * (2 - FLATTENING);
const eccentricitySquaredPrime = eccentricitySquared / (1 - eccentricitySquared);

const centralMeridianRad = CENTRAL_MERIDIAN_DEG * DEG_TO_RAD;
const originLatitudeRad = ORIGIN_LATITUDE_DEG * DEG_TO_RAD;

function meridionalArc(latitudeRad: number): number {
  const e2 = eccentricitySquared;

  return (
    SEMI_MAJOR_AXIS_M *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latitudeRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latitudeRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latitudeRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latitudeRad))
  );
}

const originMeridionalArc = meridionalArc(originLatitudeRad);

/**
 * Converts a WGS84 lat/lon into EPSG:5181 (GRS80 중부원점 TM) meters.
 */
export function convertToTmCoordinate(lat: number, lon: number): TmCoordinate {
  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = SEMI_MAJOR_AXIS_M / Math.sqrt(1 - eccentricitySquared * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = eccentricitySquaredPrime * cosLat * cosLat;
  const A = (lonRad - centralMeridianRad) * cosLat;

  const M = meridionalArc(latRad);

  const x =
    SCALE_FACTOR *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * eccentricitySquaredPrime) * Math.pow(A, 5)) / 120) +
    FALSE_EASTING_M;

  const y =
    SCALE_FACTOR *
      (M -
        originMeridionalArc +
        N *
          tanLat *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * eccentricitySquaredPrime) * Math.pow(A, 6)) /
              720)) +
    FALSE_NORTHING_M;

  return { tmX: x, tmY: y };
}
