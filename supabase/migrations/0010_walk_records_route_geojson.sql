alter table public.walk_records
  add column if not exists route_geojson jsonb;

update public.walk_records
set route_geojson = ST_AsGeoJSON(route)::jsonb
where route is not null
  and route_geojson is null;
