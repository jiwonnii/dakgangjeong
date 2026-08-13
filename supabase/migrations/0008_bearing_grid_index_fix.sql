-- Fixes compute_bearing_grid_counts (0004) to actually use
-- road_segments_path_idx. The original body called ST_DWithin on two
-- `::geography` casts of `rs.path` (a `geometry` column) — casting a
-- geometry column to geography inside a spatial predicate stops Postgres
-- from recognizing the underlying geometry GIST index, so every call
-- degenerated into a full scan of road_segments per grid cell. Confirmed
-- 2026-08-10: a single 300-cell chunk against a 97,835-row road_segments
-- table didn't finish within 60s; EXPLAIN itself timed out.
--
-- Fix: add a `path && ST_Expand(point, radius_in_degrees)` bounding-box
-- pre-filter — the `&&` operator on plain geometry values IS index-aware —
-- before the precise `ST_DWithin(geography, geography, meters)` check.
-- The degrees conversion is a deliberately generous approximation (a
-- fixed /111320 plus 50% margin, not latitude-corrected) since it only
-- narrows the index scan; the geography check afterward is exact regardless
-- of how loose the bounding box is. Verified this rewrite: the same
-- 300-cell chunk that didn't finish in 60s completed in ~600ms.
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
    on rs.path && ST_Expand(
      ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326),
      (search_radius_m / 111320.0) * 1.5
    )
    and ST_DWithin(
      ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326)::geography,
      rs.path::geography,
      search_radius_m
    )
  group by c.idx, bearing_bin;
$$;
