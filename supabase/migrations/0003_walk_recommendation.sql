-- Walk course recommendation: road segment scoring, environment reference data,
-- breed exercise lookup, and precomputed caches.
-- See docs/walk-recommendation-spec.md for the full design.

create table if not exists public.road_segments (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'osm',
  path geometry(LineString, 4326) not null,
  road_class text not null check (
    road_class in (
      'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
      'residential', 'living_street', 'footway', 'pedestrian', 'steps', 'other'
    )
  ),
  lanes smallint,
  max_speed_kmh smallint,
  average_slope numeric(5, 2),
  lit boolean not null default false,
  is_pedestrian_only boolean not null default false,
  is_pedestrian_priority boolean not null default false,
  is_school_zone boolean not null default false,
  has_speed_bump boolean not null default false,
  vehicle_exposure numeric(3, 2) not null default 2.5 check (
    vehicle_exposure >= 0 and vehicle_exposure <= 5
  ),
  length_m numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists road_segments_path_idx
  on public.road_segments using gist (path);

create index if not exists road_segments_road_class_idx
  on public.road_segments (road_class);

drop trigger if exists road_segments_set_updated_at on public.road_segments;
create trigger road_segments_set_updated_at
  before update on public.road_segments
  for each row execute function public.set_updated_at();

create table if not exists public.street_trees (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'unknown',
  point geometry(Point, 4326) not null,
  species text,
  height_m numeric(5, 2),
  canopy_width_m numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists street_trees_point_idx
  on public.street_trees using gist (point);

create table if not exists public.parks (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'unknown',
  name text not null,
  park_type text,
  geom geometry(Geometry, 4326) not null,
  radius_m numeric(8, 2),
  area_sqm numeric(12, 2),
  created_at timestamptz not null default now()
);

create index if not exists parks_geom_idx
  on public.parks using gist (geom);

create table if not exists public.benches (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'osm',
  point geometry(Point, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists benches_point_idx
  on public.benches using gist (point);

create table if not exists public.streetlights (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'unknown',
  point geometry(Point, 4326) not null,
  light_type text not null default 'streetlight' check (
    light_type in ('streetlight', 'security_light')
  ),
  created_at timestamptz not null default now()
);

create index if not exists streetlights_point_idx
  on public.streetlights using gist (point);

create table if not exists public.dog_density (
  id uuid primary key default extensions.gen_random_uuid(),
  dong_code text not null unique,
  dong_name text not null,
  geom geometry(Geometry, 4326) not null,
  registered_count integer not null default 0,
  area_sqkm numeric(10, 4),
  density_per_sqkm numeric(10, 2),
  updated_at timestamptz not null default now()
);

create index if not exists dog_density_geom_idx
  on public.dog_density using gist (geom);

drop trigger if exists dog_density_set_updated_at on public.dog_density;
create trigger dog_density_set_updated_at
  before update on public.dog_density
  for each row execute function public.set_updated_at();

create table if not exists public.pet_facilities (
  id uuid primary key default extensions.gen_random_uuid(),
  external_id text,
  source text not null default 'unknown',
  point geometry(Point, 4326) not null,
  facility_type text not null check (
    facility_type in ('playground', 'hospital', 'grooming', 'cafe', 'other')
  ),
  name text,
  created_at timestamptz not null default now()
);

create index if not exists pet_facilities_point_idx
  on public.pet_facilities using gist (point);

create table if not exists public.breed_exercise (
  breed_id text primary key references public.dog_breeds(id) on delete cascade,
  kc_grade text not null default 'up_to_1_hour' check (
    kc_grade in ('up_to_30_min', 'up_to_1_hour', 'up_to_2_hours', 'over_2_hours')
  ),
  size_class text not null default 'medium' check (
    size_class in ('toy', 'small', 'medium', 'large', 'giant')
  ),
  is_brachycephalic boolean not null default false,
  is_double_coat boolean not null default false,
  senior_age_years_override numeric(4, 1),
  source text not null default 'akc_group_default',
  updated_at timestamptz not null default now()
);

drop trigger if exists breed_exercise_set_updated_at on public.breed_exercise;
create trigger breed_exercise_set_updated_at
  before update on public.breed_exercise
  for each row execute function public.set_updated_at();

create table if not exists public.bearing_grid (
  grid_key text not null,
  bearing_bin smallint not null check (bearing_bin >= 0 and bearing_bin <= 7),
  center_lat double precision not null,
  center_lon double precision not null,
  road_count integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (grid_key, bearing_bin)
);

create table if not exists public.walk_course_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists walk_course_cache_expires_at_idx
  on public.walk_course_cache (expires_at);

alter table public.road_segments enable row level security;
alter table public.street_trees enable row level security;
alter table public.parks enable row level security;
alter table public.benches enable row level security;
alter table public.streetlights enable row level security;
alter table public.dog_density enable row level security;
alter table public.pet_facilities enable row level security;
alter table public.breed_exercise enable row level security;
alter table public.bearing_grid enable row level security;
alter table public.walk_course_cache enable row level security;

drop policy if exists "Road segments are publicly readable" on public.road_segments;
create policy "Road segments are publicly readable"
  on public.road_segments for select
  using (true);

drop policy if exists "Street trees are publicly readable" on public.street_trees;
create policy "Street trees are publicly readable"
  on public.street_trees for select
  using (true);

drop policy if exists "Parks are publicly readable" on public.parks;
create policy "Parks are publicly readable"
  on public.parks for select
  using (true);

drop policy if exists "Benches are publicly readable" on public.benches;
create policy "Benches are publicly readable"
  on public.benches for select
  using (true);

drop policy if exists "Streetlights are publicly readable" on public.streetlights;
create policy "Streetlights are publicly readable"
  on public.streetlights for select
  using (true);

drop policy if exists "Dog density is publicly readable" on public.dog_density;
create policy "Dog density is publicly readable"
  on public.dog_density for select
  using (true);

drop policy if exists "Pet facilities are publicly readable" on public.pet_facilities;
create policy "Pet facilities are publicly readable"
  on public.pet_facilities for select
  using (true);

drop policy if exists "Breed exercise data is publicly readable" on public.breed_exercise;
create policy "Breed exercise data is publicly readable"
  on public.breed_exercise for select
  using (true);

-- bearing_grid and walk_course_cache are internal precomputed data queried only
-- through the service role from the backend. No select policy is defined, so
-- RLS blocks anon/authenticated client access while the service role bypasses it.
