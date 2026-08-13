-- Fixes score_route_candidates (0006): every ST_DWithin(path_geog,
-- x::geography, radius) predicate cast the STORED geometry column
-- (t.point, b.point, pf.point, rs.path) to geography inline, which stops
-- Postgres from using the underlying geometry GIST indexes
-- (street_trees_point_idx, benches_point_idx, pet_facilities_point_idx,
-- road_segments_path_idx) — same root cause as 0008's bearing-grid fix,
-- just spread across more tables. With street_trees at 141,534 rows and
-- road_segments at 97,835, a real recommendation request's scoring call
-- (up to 6 candidates, each running these checks including the
-- road_segments check TWICE — vehicle_exposure and steps_count) hit
-- PostgREST's statement_timeout on first live use. Confirmed 2026-08-10.
--
-- Fix: same technique as 0008 — a `geom_col && ST_Expand(point, radius_in_
-- degrees)` bounding-box pre-filter (index-aware on the plain geometry
-- column) before the precise geography ST_DWithin check. ST_Intersects
-- calls against parks/risk_zones were already geometry-only (no geography
-- cast) and are untouched — those already use their indexes.
create or replace function public.score_route_candidates(
  candidate_indices integer[],
  candidate_paths_geojson text[],
  dog_id_param uuid,
  tree_radius_m double precision,
  bench_radius_m double precision,
  pet_facility_radius_m double precision,
  diversity_corridor_width_m double precision,
  diversity_lookback_days integer,
  road_match_buffer_m double precision
)
returns table (
  cell_index integer,
  length_m double precision,
  trees_per_km double precision,
  park_ratio double precision,
  risk_zone_count integer,
  bench_count integer,
  pet_facility_count integer,
  diversity_overlap_ratio double precision,
  vehicle_exposure_avg double precision,
  steps_count integer
)
language plpgsql
stable
as $$
declare
  i integer;
  path_geom geometry;
  path_geog geography;
  path_length_m double precision;
  path_bbox geometry;
  v_tree_count integer;
  v_trees_per_km double precision;
  park_intersection_length double precision;
  v_park_ratio double precision;
  v_risk_zone_count integer;
  v_bench_count integer;
  v_pet_facility_count integer;
  diversity_intersection_length double precision;
  v_diversity_ratio double precision;
  v_exposure_weighted_sum double precision;
  v_exposure_weight_total double precision;
  v_vehicle_exposure double precision;
  v_steps_count integer;
  tree_radius_deg double precision;
  bench_radius_deg double precision;
  pet_facility_radius_deg double precision;
  road_match_buffer_deg double precision;
begin
  -- Degrees-equivalent bbox margins: deliberately generous (not latitude-
  -- corrected), since they only narrow the index scan — the geography
  -- ST_DWithin checks that follow are exact regardless of how loose these
  -- are. Same approximation 0008 uses.
  tree_radius_deg := (tree_radius_m / 111320.0) * 1.5;
  bench_radius_deg := (bench_radius_m / 111320.0) * 1.5;
  pet_facility_radius_deg := (pet_facility_radius_m / 111320.0) * 1.5;
  road_match_buffer_deg := (road_match_buffer_m / 111320.0) * 1.5;

  for i in 1 .. array_length(candidate_indices, 1) loop
    path_geom := ST_SetSRID(ST_GeomFromGeoJSON(candidate_paths_geojson[i]), 4326);
    path_geog := path_geom::geography;
    path_length_m := ST_Length(path_geog);
    path_bbox := ST_Envelope(path_geom);

    select count(*) into v_tree_count
    from public.street_trees t
    where t.point && ST_Expand(path_bbox, tree_radius_deg)
      and ST_DWithin(path_geog, t.point::geography, tree_radius_m);

    v_trees_per_km := case
      when path_length_m > 0 then v_tree_count / (path_length_m / 1000.0)
      else 0
    end;

    select coalesce(sum(ST_Length(ST_Intersection(path_geom, p.geom)::geography)), 0)
      into park_intersection_length
    from public.parks p
    where ST_Intersects(path_geom, p.geom);

    v_park_ratio := case
      when path_length_m > 0 then least(1.0, park_intersection_length / path_length_m)
      else 0
    end;

    select count(*) into v_risk_zone_count
    from public.risk_zones rz
    where ST_Intersects(path_geom, rz.geom);

    select count(*) into v_bench_count
    from public.benches b
    where b.point && ST_Expand(path_bbox, bench_radius_deg)
      and ST_DWithin(path_geog, b.point::geography, bench_radius_m);

    select count(*) into v_pet_facility_count
    from public.pet_facilities pf
    where pf.point && ST_Expand(path_bbox, pet_facility_radius_deg)
      and ST_DWithin(path_geog, pf.point::geography, pet_facility_radius_m);

    select coalesce(
        sum(
          ST_Length(
            ST_Intersection(
              path_geom,
              ST_Buffer(wr.route::geography, diversity_corridor_width_m)::geometry
            )::geography
          )
        ),
        0
      )
      into diversity_intersection_length
    from public.walk_records wr
    where wr.dog_id = dog_id_param
      and wr.route is not null
      and wr.started_at >= now() - (diversity_lookback_days || ' days')::interval;

    v_diversity_ratio := case
      when path_length_m > 0 then least(1.0, diversity_intersection_length / path_length_m)
      else 0
    end;

    select
      sum(matched.overlap_len * matched.vehicle_exposure),
      sum(matched.overlap_len)
      into v_exposure_weighted_sum, v_exposure_weight_total
    from (
      select
        rs.vehicle_exposure,
        ST_Length(
          ST_Intersection(
            path_geom,
            ST_Buffer(rs.path::geography, road_match_buffer_m)::geometry
          )::geography
        ) as overlap_len
      from public.road_segments rs
      where rs.path && ST_Expand(path_bbox, road_match_buffer_deg)
        and ST_DWithin(path_geog, rs.path::geography, road_match_buffer_m)
    ) matched
    where matched.overlap_len > 0;

    v_vehicle_exposure := case
      when coalesce(v_exposure_weight_total, 0) > 0
        then v_exposure_weighted_sum / v_exposure_weight_total
      else null
    end;

    select count(*) into v_steps_count
    from public.road_segments rs
    where rs.road_class = 'steps'
      and rs.path && ST_Expand(path_bbox, road_match_buffer_deg)
      and ST_DWithin(path_geog, rs.path::geography, road_match_buffer_m);

    cell_index := candidate_indices[i];
    length_m := path_length_m;
    trees_per_km := v_trees_per_km;
    park_ratio := v_park_ratio;
    risk_zone_count := v_risk_zone_count;
    bench_count := v_bench_count;
    pet_facility_count := v_pet_facility_count;
    diversity_overlap_ratio := v_diversity_ratio;
    vehicle_exposure_avg := v_vehicle_exposure;
    steps_count := v_steps_count;

    return next;
  end loop;
end;
$$;

-- Same fix for find_nearby_park_polygons (0005) — used live by
-- route-generation.service.ts on every recommendation request (not just
-- ingest), same `p.geom::geography` cast preventing index use on
-- parks_geom_idx. parks is only 19,154 rows so this hadn't yet timed out
-- in testing, but it's the same bug and cheap to fix alongside the rest.
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
  where p.geom && ST_Expand(
    ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326),
    (radius_m / 111320.0) * 1.5
  )
  and ST_DWithin(
    ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326)::geography,
    p.geom::geography,
    radius_m
  );
$$;
