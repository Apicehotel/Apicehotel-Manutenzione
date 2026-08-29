create extension if not exists pgcrypto;

create table if not exists public.randai_credentials (
  id uuid primary key default gen_random_uuid(),
  legacy_user_id uuid not null unique references public.utenti(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  must_change_password boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint randai_username_format check (username ~ '^[A-Za-z0-9._-]{3,32}$')
);

create unique index if not exists randai_credentials_username_lower_idx on public.randai_credentials (lower(username));
alter table public.randai_credentials enable row level security;

insert into public.role_permissions (role,module,action,allowed)
select 'RandAI', module, action, allowed
from public.role_permissions
where role='admin'
on conflict (role,module,action) do update set allowed=excluded.allowed, updated_at=now();

with existing as (
  select id from public.utenti where lower(nome)=lower('RandAI') limit 1
), seeded as (
  insert into public.utenti (nome,ruolo,pin,hotels,puo_admin,deve_cambiare_pin,active,is_system_protected)
  select 'RandAI','RandAI',null,array['hotelgio','chocohotel','brigantino']::text[],true,false,true,false
  where not exists (select 1 from existing)
  returning id
), target as (
  select id from seeded union all select id from existing limit 1
)
insert into public.randai_credentials (legacy_user_id,username,password_hash,must_change_password)
select id,'RandAI',crypt('00000000',gen_salt('bf',11)),true from target
on conflict (username) do nothing;
