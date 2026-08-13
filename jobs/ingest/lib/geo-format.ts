/**
 * EWKT (Extended WKT) builders for inserting geometry directly into a
 * `geometry(Type, 4326)` column via supabase-js's plain `.insert()`/
 * `.upsert()`.
 *
 * A GeoJSON string is NOT valid input for a raw geometry column insert —
 * PostGIS's `geometry_in` parser accepts WKB or (E)WKT, not GeoJSON, so a
 * plain `{"type":"Point","coordinates":[...]}` string would fail to parse.
 * Plain WKT without an SRID prefix would parse, but as SRID 0, which then
 * fails the column's `geometry(..., 4326)` typmod constraint. EWKT's
 * `SRID=4326;...` prefix is what makes a directly-inserted value both
 * parseable and valid for these columns — every ingest-*.ts script in this
 * project must use these builders (not JSON.stringify) when writing a
 * geometry/point/polygon column directly. RPC functions that call
 * `ST_GeomFromGeoJSON` explicitly (as several round 5-9 migrations do) are
 * unaffected — this only matters for inserting through the REST data API.
 */

export function toEwktPoint(lon: number, lat: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

export function toEwktLineString(coordinates: readonly [number, number][]): string {
  const points = coordinates.map(([lon, lat]) => `${lon} ${lat}`).join(", ");
  return `SRID=4326;LINESTRING(${points})`;
}

/** `rings[0]` is the outer ring, any further entries are holes — each ring
 * must already be closed (first point === last point). */
export function toEwktPolygon(rings: readonly (readonly [number, number][])[]): string {
  const ringsWkt = rings
    .map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`)
    .join(", ");

  return `SRID=4326;POLYGON(${ringsWkt})`;
}
