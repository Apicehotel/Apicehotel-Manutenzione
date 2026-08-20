alter table public.profiles add column if not exists legacy_user_id uuid unique; create index if not exists profiles_legacy_user_id_idx on public.profiles(legacy_user_id);
