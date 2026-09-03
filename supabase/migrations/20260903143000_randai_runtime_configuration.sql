-- RandAI Block 13 / point 54: versioned, hotel-scoped, non-secret runtime configuration.
-- Supabase RLS/RPC remains authoritative. Global safety invariants remain code-owned and immutable from this UI.

create table if not exists public.randai_runtime_config (
  id uuid primary key default gen_random_uuid(),
  hotel_id text null check (hotel_id is null or hotel_id in ('hotelgio','chocohotel','brigantino')),
  section text not null check (section in ('models','budgets','autonomy','knowledge','memory','actions','recovery','evals')),
  key text not null,
  value jsonb not null,
  enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists randai_runtime_config_scope_key_uq
  on public.randai_runtime_config (coalesce(hotel_id, '__global__'), section, key);

create table if not exists public.randai_runtime_config_history (
  history_id bigint generated always as identity primary key,
  config_id uuid not null,
  hotel_id text null,
  section text not null,
  key text not null,
  value jsonb not null,
  enabled boolean not null,
  version integer not null,
  changed_by uuid null,
  changed_at timestamptz not null default now()
);

alter table public.randai_runtime_config enable row level security;
alter table public.randai_runtime_config_history enable row level security;

create or replace function public.randai_is_admin_for_hotel(p_hotel_id text)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid() and hm.hotel_id = p_hotel_id
      and hm.active = true and hm.can_access_admin = true and hm.role = 'RandAI'
  );
$$;

create or replace function public.randai_is_global_admin()
returns boolean language sql stable security invoker set search_path = public as $$
  select count(distinct hm.hotel_id) = 3
  from public.hotel_memberships hm
  where hm.auth_user_id = auth.uid() and hm.hotel_id in ('hotelgio','chocohotel','brigantino')
    and hm.active = true and hm.can_access_admin = true and hm.role = 'RandAI';
$$;

create policy randai_runtime_config_read on public.randai_runtime_config
for select to authenticated using (
  (hotel_id is not null and public.randai_is_admin_for_hotel(hotel_id))
  or (hotel_id is null and exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid() and hm.active = true and hm.can_access_admin = true and hm.role = 'RandAI'
  ))
);

create policy randai_runtime_config_history_read on public.randai_runtime_config_history
for select to authenticated using (
  (hotel_id is not null and public.randai_is_admin_for_hotel(hotel_id))
  or (hotel_id is null and public.randai_is_global_admin())
);

-- Direct client writes are intentionally impossible. All changes pass the RPC below.
revoke insert, update, delete on public.randai_runtime_config from authenticated;
revoke insert, update, delete on public.randai_runtime_config_history from authenticated;
grant select on public.randai_runtime_config to authenticated;
grant select on public.randai_runtime_config_history to authenticated;

create or replace function public.randai_set_runtime_config(
  p_hotel_id text, p_section text, p_key text, p_value jsonb, p_expected_version integer default 0
)
returns public.randai_runtime_config
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.randai_runtime_config;
  v_next_version integer;
  v_number numeric;
begin
  if auth.uid() is null then raise exception 'RANDAI_AUTH_REQUIRED'; end if;
  if p_hotel_id is null then raise exception 'RANDAI_EXPLICIT_HOTEL_REQUIRED'; end if;
  if p_hotel_id not in ('hotelgio','chocohotel','brigantino') then raise exception 'RANDAI_INVALID_HOTEL'; end if;
  if not public.randai_is_admin_for_hotel(p_hotel_id) then raise exception 'RANDAI_HOTEL_ADMIN_REQUIRED'; end if;

  -- Fail closed: only UI-exposed, non-secret, non-safety-invariant keys are writable.
  if (p_section,p_key) not in (
    ('models','primary_provider'),('models','primary_model'),('models','fallback_enabled'),('models','fallback_model'),
    ('budgets','max_request_cost_usd'),('budgets','max_daily_cost_usd'),
    ('autonomy','default_mode'),('recovery','enabled')
  ) then raise exception 'RANDAI_CONFIG_KEY_NOT_WRITABLE'; end if;

  if p_value is null then raise exception 'RANDAI_CONFIG_VALUE_REQUIRED'; end if;

  if (p_section,p_key) in (('models','primary_provider'),('models','primary_model'),('models','fallback_model')) then
    if jsonb_typeof(p_value) <> 'string' or length(trim(p_value #>> '{}')) > 120 then raise exception 'RANDAI_INVALID_TEXT_CONFIG'; end if;
  elsif (p_section,p_key) in (('models','fallback_enabled'),('recovery','enabled')) then
    if jsonb_typeof(p_value) <> 'boolean' then raise exception 'RANDAI_INVALID_BOOLEAN_CONFIG'; end if;
  elsif (p_section,p_key) in (('budgets','max_request_cost_usd'),('budgets','max_daily_cost_usd')) then
    if jsonb_typeof(p_value) <> 'number' then raise exception 'RANDAI_INVALID_NUMBER_CONFIG'; end if;
    v_number := (p_value #>> '{}')::numeric;
    if v_number < 0 or (p_key='max_request_cost_usd' and v_number > 100) or (p_key='max_daily_cost_usd' and v_number > 10000) then raise exception 'RANDAI_CONFIG_OUT_OF_RANGE'; end if;
  elsif (p_section,p_key)=('autonomy','default_mode') then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') not in ('REVIEW','BLOCK','AUTO_LOW_RISK') then raise exception 'RANDAI_INVALID_AUTONOMY_MODE'; end if;
  end if;

  select * into v_row from public.randai_runtime_config
  where hotel_id = p_hotel_id and section = p_section and key = p_key for update;

  if found then
    if p_expected_version <> v_row.version then raise exception 'RANDAI_CONFIG_VERSION_CONFLICT'; end if;
    v_next_version := v_row.version + 1;
    insert into public.randai_runtime_config_history(config_id,hotel_id,section,key,value,enabled,version,changed_by)
      values(v_row.id,v_row.hotel_id,v_row.section,v_row.key,v_row.value,v_row.enabled,v_row.version,auth.uid());
    update public.randai_runtime_config
      set value=p_value, version=v_next_version, updated_by=auth.uid(), updated_at=now()
      where id=v_row.id returning * into v_row;
  else
    if p_expected_version <> 0 then raise exception 'RANDAI_CONFIG_VERSION_CONFLICT'; end if;
    insert into public.randai_runtime_config(hotel_id,section,key,value,enabled,version,updated_by)
      values(p_hotel_id,p_section,p_key,p_value,true,1,auth.uid()) returning * into v_row;
  end if;
  return v_row;
end;
$$;

revoke all on function public.randai_set_runtime_config(text,text,text,jsonb,integer) from public;
grant execute on function public.randai_set_runtime_config(text,text,text,jsonb,integer) to authenticated;
