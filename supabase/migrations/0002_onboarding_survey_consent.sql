alter table public.guardian_profiles
  add column if not exists location_permission_agreed boolean not null default false,
  add column if not exists notification_permission_agreed boolean not null default false,
  add column if not exists marketing_agreed boolean not null default false,
  add column if not exists location_permission_agreed_at timestamptz,
  add column if not exists notification_permission_agreed_at timestamptz,
  add column if not exists marketing_agreed_at timestamptz;

alter table public.dogs
  add column if not exists social_preference text not null default 'neutral',
  add column if not exists personality_tags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dogs_social_preference_check'
      and conrelid = 'public.dogs'::regclass
  ) then
    alter table public.dogs
      add constraint dogs_social_preference_check
      check (social_preference in ('likes_dogs', 'avoids_dogs', 'neutral'));
  end if;
end $$;
