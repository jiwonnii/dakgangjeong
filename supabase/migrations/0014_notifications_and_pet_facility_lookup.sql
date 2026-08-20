create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid references public.dogs(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('care_nudge', 'walk_reminder')),
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_dog_created_idx
  on public.notifications (dog_id, created_at desc);

create unique index if not exists notifications_dedupe_key_unique_idx
  on public.notifications (dedupe_key);

alter table public.notifications enable row level security;

drop policy if exists "Notifications are visible to recipients" on public.notifications;
create policy "Notifications are visible to recipients"
  on public.notifications for select
  using (auth.uid() = recipient_user_id);

drop policy if exists "Recipients can mark notifications read" on public.notifications;
create policy "Recipients can mark notifications read"
  on public.notifications for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

create or replace function public.list_pet_facilities_nearby(
  origin_lat double precision,
  origin_lon double precision,
  radius_m double precision default 1500,
  facility_type_filter text default null,
  result_limit integer default 30
)
returns table (
  id uuid,
  name text,
  facility_type text,
  source text,
  lat double precision,
  lon double precision,
  distance_m double precision
)
language sql
stable
as $$
  with origin as (
    select ST_SetSRID(ST_MakePoint(origin_lon, origin_lat), 4326) as geom
  )
  select
    facility.id,
    facility.name,
    facility.facility_type,
    facility.source,
    ST_Y(facility.point) as lat,
    ST_X(facility.point) as lon,
    ST_Distance(facility.point::geography, origin.geom::geography) as distance_m
  from public.pet_facilities facility, origin
  where
    facility.point is not null
    and (facility_type_filter is null or facility.facility_type = facility_type_filter)
    and ST_DWithin(facility.point::geography, origin.geom::geography, radius_m)
  order by distance_m asc
  limit least(greatest(result_limit, 1), 100);
$$;
