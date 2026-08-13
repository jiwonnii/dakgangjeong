alter table public.walk_records
  add column if not exists liked_factor text,
  add column if not exists disliked_factor text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'walk_records_liked_factor_check'
  ) then
    alter table public.walk_records
      add constraint walk_records_liked_factor_check
      check (liked_factor is null or liked_factor in (
        'riskZones',
        'vehicleExposure',
        'pedestrianSafety',
        'environment',
        'familiarity',
        'fit'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'walk_records_disliked_factor_check'
  ) then
    alter table public.walk_records
      add constraint walk_records_disliked_factor_check
      check (disliked_factor is null or disliked_factor in (
        'riskZones',
        'vehicleExposure',
        'pedestrianSafety',
        'environment',
        'familiarity',
        'fit'
      ));
  end if;
end $$;
