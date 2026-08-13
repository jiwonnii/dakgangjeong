/**
 * Converts WGS84 latitude/longitude into the 기상청 단기예보 조회서비스
 * grid coordinates (nx, ny), per spec 4.1 note 2: "기상청 단기예보는
 * 위경도가 아닌 격자 좌표(nx, ny)를 요구함. 변환 공식 별도 구현 필요."
 *
 * This is KMA's own published Lambert Conformal Conic (LCC) projection
 * formula (widely distributed as the official sample conversion code
 * accompanying the 단기예보 API documentation), reimplemented here in
 * TypeScript. The projection constants below (RE, GRID, SLAT1, SLAT2,
 * OLON, OLAT, XO, YO) are fixed by that specification and must not be
 * changed independently of it.
 */

export type KmaGridCoordinate = {
  nx: number;
  ny: number;
};

const EARTH_RADIUS_KM = 6371.00877;
const GRID_SPACING_KM = 5.0;
const STANDARD_PARALLEL_1_DEG = 30.0;
const STANDARD_PARALLEL_2_DEG = 60.0;
const ORIGIN_LON_DEG = 126.0;
const ORIGIN_LAT_DEG = 38.0;
const ORIGIN_X_GRID = 43;
const ORIGIN_Y_GRID = 136;

const DEG_TO_RAD = Math.PI / 180.0;

const scaledEarthRadius = EARTH_RADIUS_KM / GRID_SPACING_KM;
const standardParallel1Rad = STANDARD_PARALLEL_1_DEG * DEG_TO_RAD;
const standardParallel2Rad = STANDARD_PARALLEL_2_DEG * DEG_TO_RAD;
const originLonRad = ORIGIN_LON_DEG * DEG_TO_RAD;
const originLatRad = ORIGIN_LAT_DEG * DEG_TO_RAD;

const coneConstant = (() => {
  const sn =
    Math.log(Math.cos(standardParallel1Rad) / Math.cos(standardParallel2Rad)) /
    Math.log(
      Math.tan(Math.PI * 0.25 + standardParallel2Rad * 0.5) /
        Math.tan(Math.PI * 0.25 + standardParallel1Rad * 0.5)
    );
  return sn;
})();

const scaleFactor = (() => {
  const sf = Math.pow(Math.tan(Math.PI * 0.25 + standardParallel1Rad * 0.5), coneConstant) *
    (Math.cos(standardParallel1Rad) / coneConstant);
  return sf;
})();

const originRadius =
  (scaledEarthRadius * scaleFactor) /
  Math.pow(Math.tan(Math.PI * 0.25 + originLatRad * 0.5), coneConstant);

/**
 * Converts a WGS84 lat/lon into the KMA 5km LCC grid (nx, ny), rounded to
 * the nearest integer grid cell as the KMA reference implementation does.
 */
export function convertToKmaGrid(lat: number, lon: number): KmaGridCoordinate {
  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;

  const radius =
    (scaledEarthRadius * scaleFactor) / Math.pow(Math.tan(Math.PI * 0.25 + latRad * 0.5), coneConstant);

  let theta = lonRad - originLonRad;

  if (theta > Math.PI) {
    theta -= 2.0 * Math.PI;
  }

  if (theta < -Math.PI) {
    theta += 2.0 * Math.PI;
  }

  theta *= coneConstant;

  const nx = Math.floor(radius * Math.sin(theta) + ORIGIN_X_GRID + 0.5);
  const ny = Math.floor(originRadius - radius * Math.cos(theta) + ORIGIN_Y_GRID + 0.5);

  return { nx, ny };
}
