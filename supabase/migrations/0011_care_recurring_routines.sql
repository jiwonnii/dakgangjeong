create table if not exists public.care_routines (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  task_type text not null check (
    task_type in ('walk', 'feed', 'medicine', 'grooming', 'hospital', 'other')
  ),
  title text not null,
  instructions text,
  frequency text not null default 'daily' check (
    frequency in ('once', 'daily', 'weekly', 'monthly')
  ),
  interval_count integer not null default 1 check (interval_count > 0),
  days_of_week smallint[] not null default '{}',
  days_of_month smallint[] not null default '{}',
  times_of_day time[] not null default '{09:00}',
  start_date date not null default current_date,
  end_date date,
  timezone text not null default 'Asia/Seoul',
  reminder_minutes_before integer[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.care_tasks
  add column if not exists routine_id uuid references public.care_routines(id) on delete cascade,
  add column if not exists scheduled_at timestamptz,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  add column if not exists skipped_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.care_tasks
set scheduled_at = scheduled_for::timestamptz
where scheduled_at is null;

create index if not exists care_routines_dog_active_idx
  on public.care_routines (dog_id, is_active, start_date);

create index if not exists care_tasks_routine_scheduled_idx
  on public.care_tasks (routine_id, scheduled_at);

create unique index if not exists care_tasks_routine_scheduled_unique_idx
  on public.care_tasks (routine_id, scheduled_at)
  where routine_id is not null;

drop trigger if exists care_routines_set_updated_at on public.care_routines;
create trigger care_routines_set_updated_at
  before update on public.care_routines
  for each row execute function public.set_updated_at();

alter table public.care_routines enable row level security;

drop policy if exists "Care routines are manageable by linked guardians" on public.care_routines;
create policy "Care routines are manageable by linked guardians"
  on public.care_routines for all
  using (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_routines.dog_id
        and dg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dog_guardians dg
      where dg.dog_id = care_routines.dog_id
        and dg.user_id = auth.uid()
    )
  );
