-- RPC functions backing scoring.service.ts (spec 5.5 사후 채점).
--
-- score_route_candidates computes, for each of up to 6 candidate routes in
-- one round trip: length, tree density, park coverage ratio, risk-zone
-- crossings, bench count, nearby pet-facility count, and overlap with this
-- dog's own recent walks (다양성). A plpgsql loop (not a single set-based
-- query) is used deliberately — with only ~6 candidates per call this is
-- simple to read and verify correctly, unlike the 0004 bearing_grid batch
-- function which processes thousands of cells and needed to be set-based
-- for performance.
--
-- "다양성" (diversity_overlap_ratio) approximates how much of a candidate
-- route retraces a walk this dog has already done recently. Two raw
-- LineStrings essentially never overlap along a length (only at isolated
-- points), so the historical route is buffered into a narrow corridor
-- (DIVERSITY_CORRIDOR_WIDTH_M, passed in as a parameter) before
-- intersecting — the standard GIS technique for line-similarity length.
--
-- "차량 노출도" (vehicle_exposure_avg) is a length-weighted average of
-- `road_segments.vehicle_exposure` over every stored road segment the
-- candidate path runs alongside, matched via ST_DWithin within
-- road_match_buffer_m. This tolerance exists because the candidate's
-- geometry comes from GraphHopper's own routing graph, which may snap
-- slightly differently than our independently-ingested road_segments even
-- when both represent the same physical street. Returns NULL when no
-- road_segments matched at all (e.g. ingest gap for that area) — the
-- caller (scoring-filter.ts, round 9) decides how to treat that, rather
-- than this function silently guessing a default.
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
begin
  for i in 1 .. array_length(candidate_indices, 1) loop
    path_geom := ST_SetSRID(ST_GeomFromGeoJSON(candidate_paths_geojson[i]), 4326);
    path_geog := path_geom::geography;
    path_length_m := ST_Length(path_geog);

    select count(*) into v_tree_count
    from public.street_trees t
    where ST_DWithin(path_geog, t.point::geography, tree_radius_m);

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
    where ST_DWithin(path_geog, b.point::geography, bench_radius_m);

    select count(*) into v_pet_facility_count
    from public.pet_facilities pf
    where ST_DWithin(path_geog, pf.point::geography, pet_facility_radius_m);

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
      where ST_DWithin(path_geog, rs.path::geography, road_match_buffer_m)
    ) matched
    where matched.overlap_len > 0;

    v_vehicle_exposure := case
      when coalesce(v_exposure_weight_total, 0) > 0
        then v_exposure_weighted_sum / v_exposure_weight_total
      else null
    end;

    -- Safety net for 5.6 1차 필터 "계단 포함 시 탈락 (해당 견종에 한함)".
    -- The custom model already makes STEPS impassable (priority 0) for
    -- dogs with needsStairFilter=true, so this should normally be 0 for
    -- those dogs' candidates — this check exists for the rare case where
    -- road_segments and GraphHopper's own OSM-derived graph disagree on
    -- what counts as "steps" for the same physical location.
    select count(*) into v_steps_count
    from public.road_segments rs
    where rs.road_class = 'steps'
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

grant execute on function public.score_route_candidates(
  integer[], text[], uuid, double precision, double precision, double precision,
  double precision, integer, double precision
) to service_role;

-- Single-point lookup used once per recommendation request (not per
-- candidate, since all candidates share the same origin) to read the
-- registered-dog density of the 읍면동 containing the walk's starting
-- point (spec 5.5 개 마주칠 확률 요소 1/3).
create or replace function public.find_dong_density_at_point(
  origin_lon double precision,
  origin_lat double precision
)
returns table (dong_code text, density_per_sqkm double precision)
language sql
stable
as $$
  select d.dong_code, d.density_per_sqkm
  from public.dog_density d
  where ST_Contains(d.geom, ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326))
  limit 1;
$$;

grant execute on function public.find_dong_density_at_point(
  double precision, double precision
) to service_role;
