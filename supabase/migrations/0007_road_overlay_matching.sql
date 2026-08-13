-- RPC used by ingest-road-segments.ts phase 2 (spec 11회차) to mark
-- road_segments rows that fall near a whole overlay dataset (전국보행자
-- 전용도로/보행자우선도로/어린이보호구역/과속방지턱표준데이터) in a single
-- spatial predicate, rather than one UPDATE per overlay feature. The
-- caller passes the entire overlay dataset as one GeoJSON
-- GeometryCollection/MultiPoint string — ST_DWithin against a collection
-- geometry checks distance to the nearest member, so this is both correct
-- and efficient for datasets with many thousands of features.
--
-- flag_column is validated against a fixed allow-list before being used in
-- dynamic SQL (via %I), since it cannot be a bind parameter — this is the
-- standard safe pattern for a column name that must vary per call.
create or replace function public.mark_road_segments_near_geometry(
  overlay_geojson text,
  flag_column text,
  match_buffer_m double precision
)
returns integer
language plpgsql
as $$
declare
  overlay_geom geometry;
  updated_count integer;
begin
  if flag_column not in (
    'is_pedestrian_only', 'is_pedestrian_priority', 'is_school_zone', 'has_speed_bump'
  ) then
    raise exception 'Invalid flag_column: %', flag_column;
  end if;

  overlay_geom := ST_SetSRID(ST_GeomFromGeoJSON(overlay_geojson), 4326);

  execute format(
    'update public.road_segments set %I = true where ST_DWithin(path::geography, $1::geography, $2)',
    flag_column
  ) using overlay_geom, match_buffer_m;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.mark_road_segments_near_geometry(
  text, text, double precision
) to service_role;

-- Same technique, for lit (가로등 — 전국보안등정보표준데이터) since
-- streetlights are stored in their own table (spec 6), not inline on
-- road_segments as a source dataset.
create or replace function public.mark_road_segments_lit_near_geometry(
  overlay_geojson text,
  match_buffer_m double precision
)
returns integer
language plpgsql
as $$
declare
  overlay_geom geometry;
  updated_count integer;
begin
  overlay_geom := ST_SetSRID(ST_GeomFromGeoJSON(overlay_geojson), 4326);

  update public.road_segments
  set lit = true
  where ST_DWithin(path::geography, overlay_geom::geography, match_buffer_m);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.mark_road_segments_lit_near_geometry(
  text, double precision
) to service_role;
