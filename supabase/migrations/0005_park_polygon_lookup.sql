-- RPC function used by route-generation.service.ts to fetch park geometry
-- as GeoJSON Polygon rings for injection into a GraphHopper custom model's
-- `areas` (spec 5.4, 공원 선호 오버라이드).
--
-- `parks.geom` may be a real Polygon (e.g. OSM/전국도시공원 shapes) or a
-- Point paired with `radius_m` (spec 6: "Polygon 또는 Point + 반경"). This
-- function normalizes both into a Polygon by buffering point-sourced rows,
-- so the caller never needs to branch on which kind a park is. Ingest jobs
-- (11회차) must only set `radius_m` on point-sourced rows — a non-null
-- `radius_m` on an already-Polygon row would incorrectly buffer it too.
create or replace function public.find_nearby_park_polygons(
  origin_lon double precision,
  origin_lat double precision,
  radius_m double precision
)
returns table (park_id uuid, polygon_geojson jsonb)
language sql
stable
as $$
  select
    p.id as park_id,
    ST_AsGeoJSON(
      case
        when p.radius_m is not null then ST_Buffer(p.geom::geography, p.radius_m)::geometry
        else p.geom
      end
    )::jsonb as polygon_geojson
  from public.parks p
  where ST_DWithin(
    ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326)::geography,
    p.geom::geography,
    radius_m
  );
$$;

grant execute on function public.find_nearby_park_polygons(
  double precision, double precision, double precision
) to service_role;
