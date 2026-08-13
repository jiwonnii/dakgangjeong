-- RPC function backing the bearing_grid precompute batch (spec 5.3, 7.3)
-- and its live-fallback path in services/bearing.service.ts. Runs the
-- azimuth/bucket classification inside PostGIS instead of fetching raw
-- road geometries into the application, so a batch of grid cells can be
-- classified in one round trip.
--
-- ST_Azimuth is computed on plain `geometry` (EPSG:4326, planar x/y), not
-- `geography`: over the ~300m search radius used here the difference
-- between planar and geodesic bearing is well under 1 degree — negligible
-- against the 45-degree-wide bearing bins — so the simpler/faster planar
-- form is used deliberately, matching src/lib/geo.ts's own bearing math
-- for consistency at this scale.
create or replace function public.compute_bearing_grid_counts(
  cell_indices integer[],
  cell_lons double precision[],
  cell_lats double precision[],
  search_radius_m double precision
)
returns table (cell_index integer, bearing_bin smallint, road_count integer)
language sql
stable
as $$
  select
    c.idx as cell_index,
    (
      width_bucket(
        degrees(
          ST_Azimuth(
            ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326),
            ST_Centroid(rs.path)
          )
        )::numeric,
        array[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]::numeric[]
      ) % 8
    )::smallint as bearing_bin,
    count(*)::integer as road_count
  from unnest(cell_indices, cell_lons, cell_lats) as c(idx, lon, lat)
  join public.road_segments rs
    on ST_DWithin(
      ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326)::geography,
      rs.path::geography,
      search_radius_m
    )
  group by c.idx, bearing_bin;
$$;

grant execute on function public.compute_bearing_grid_counts(
  integer[], double precision[], double precision[], double precision
) to service_role;
