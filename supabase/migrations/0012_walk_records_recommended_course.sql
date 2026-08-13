alter table public.walk_records
  add column if not exists recommended_course jsonb;
