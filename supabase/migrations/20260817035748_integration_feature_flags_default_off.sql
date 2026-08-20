create table if not exists public.integration_settings (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.integration_settings enable row level security;
revoke all on public.integration_settings from anon, authenticated;
grant all on public.integration_settings to service_role;

insert into public.integration_settings(key, enabled, config) values
 ('push_notifications', false, '{"mode":"disabled"}'::jsonb),
 ('twilio_whatsapp', false, '{"mode":"disabled","default_country_code":"+39"}'::jsonb),
 ('pin_recovery_email', false, '{"mode":"disabled"}'::jsonb)
on conflict (key) do update set enabled = excluded.enabled, config = excluded.config, updated_at = now();

create or replace function public.integration_enabled(setting_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.integration_settings where key = setting_key), false)
$$;
revoke all on function public.integration_enabled(text) from public, anon, authenticated;
grant execute on function public.integration_enabled(text) to service_role;
