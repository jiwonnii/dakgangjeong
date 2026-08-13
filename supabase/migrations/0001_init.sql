create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.guardian_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  location_permission_agreed boolean not null default false,
  notification_permission_agreed boolean not null default false,
  marketing_agreed boolean not null default false,
  location_permission_agreed_at timestamptz,
  notification_permission_agreed_at timestamptz,
  marketing_agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed text not null,
  birth_date date not null,
  weight_kg numeric(4, 1) not null check (weight_kg > 0),
  social_preference text not null default 'neutral' check (
    social_preference in ('likes_dogs', 'avoids_dogs', 'neutral')
  ),
  personality_tags text[] not null default '{}',
  health_notes text,
  invite_code text not null unique default upper(
    substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dog_guardians (
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner', 'caregiver')),
  joined_at timestamptz not null default now(),
  primary key (dog_id, user_id)
);

create table if not exists public.risk_zones (
  id uuid primary key default extensions.gen_random_uuid(),
  type text not null check (
    type in ('traffic', 'accident', 'air_quality', 'heat', 'deicer', 'user_report')
  ),
  severity smallint not null check (severity between 1 and 5),
  source text not null,
  description text,
  geom geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.walk_records (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  distance_meters integer check (distance_meters >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  average_speed_mps numeric(5, 2),
  route geometry(LineString, 4326),
  static_map_url text,
  rating smallint check (rating between 1 and 5),
  liked_notes text,
  disliked_notes text,
  ai_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.care_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  task_type text not null check (task_type in ('walk', 'feed', 'medicine')),
  title text not null,
  scheduled_for date not null default current_date,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.care_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists risk_zones_geom_idx
  on public.risk_zones using gist (geom);

create index if not exists walk_records_route_idx
  on public.walk_records using gist (route);

create index if not exists walk_records_dog_started_idx
  on public.walk_records (dog_id, started_at desc);

create index if not exists care_tasks_dog_date_idx
  on public.care_tasks (dog_id, scheduled_for);

drop trigger if exists guardian_profiles_set_updated_at on public.guardian_profiles;
create trigger guardian_profiles_set_updated_at
  before update on public.guardian_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists dogs_set_updated_at on public.dogs;
create trigger dogs_set_updated_at
  before update on public.dogs
  for each row execute function public.set_updated_at();

create or replace function public.add_owner_as_dog_guardian()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.dog_guardians (dog_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (dog_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists dogs_add_owner_as_guardian on public.dogs;
create trigger dogs_add_owner_as_guardian
  after insert on public.dogs
  for each row execute function public.add_owner_as_dog_guardian();

alter table public.guardian_profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_guardians enable row level security;
alter table public.risk_zones enable row level security;
alter table public.walk_records enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_notes enable row level security;

drop policy if exists "Guardian profiles are readable by owner" on public.guardian_profiles;
create policy "Guardian profiles are readable by owner"
  on public.guardian_profiles for select
  using (id = auth.uid());

drop policy if exists "Guardian profiles are manageable by owner" on public.guardian_profiles;
create policy "Guardian profiles are manageable by owner"
  on public.guardian_profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Dogs are readable by linked guardians" on public.dogs;
create policy "Dogs are readable by linked guardians"
  on public.dogs for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = dogs.id
        and dg.user_id = auth.uid()
    )
  );

drop policy if exists "Dogs are manageable by owner" on public.dogs;
create policy "Dogs are manageable by owner"
  on public.dogs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Dog guardian rows are readable by linked user" on public.dog_guardians;
create policy "Dog guardian rows are readable by linked user"
  on public.dog_guardians for select
  using (user_id = auth.uid());

drop policy if exists "Users can join as dog guardian" on public.dog_guardians;
create policy "Users can join as dog guardian"
  on public.dog_guardians for insert
  with check (user_id = auth.uid());

drop policy if exists "Risk zones are readable by authenticated users" on public.risk_zones;
create policy "Risk zones are readable by authenticated users"
  on public.risk_zones for select
  using (auth.uid() is not null);

drop policy if exists "Walk records are manageable by linked guardians" on public.walk_records;
create policy "Walk records are manageable by linked guardians"
  on public.walk_records for all
  using (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = walk_records.dog_id
        and dg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = walk_records.dog_id
        and dg.user_id = auth.uid()
    )
  );

drop policy if exists "Care tasks are manageable by linked guardians" on public.care_tasks;
create policy "Care tasks are manageable by linked guardians"
  on public.care_tasks for all
  using (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_tasks.dog_id
        and dg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_tasks.dog_id
        and dg.user_id = auth.uid()
    )
  );

drop policy if exists "Care notes are manageable by linked guardians" on public.care_notes;
create policy "Care notes are manageable by linked guardians"
  on public.care_notes for all
  using (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_notes.dog_id
        and dg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_notes.dog_id
        and dg.user_id = auth.uid()
    )
  );
