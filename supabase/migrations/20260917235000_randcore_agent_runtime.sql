create table if not exists public.randcore_agent_runtime (
  agent_id text primary key,
  status text not null default 'OFFLINE' check (status in ('RUNNING','WAITING_APPROVAL','ERROR','OFFLINE','IDLE')),
  desired_state text not null default 'RUNNING' check (desired_state in ('RUNNING','PAUSED')),
  heartbeat_at timestamptz,
  task_id text,
  activity text,
  detail text,
  hotel_id text references public.hotels(id) on update cascade on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint randcore_agent_runtime_known_agent check (agent_id in ('randai','randradar','randui','randtest','randsecure','randops','randcore','randmind'))
);

alter table public.randcore_agent_runtime enable row level security;

create policy "randcore_agent_runtime_admin_read"
on public.randcore_agent_runtime for select
to authenticated
using (public.has_any_randapp_admin() or public.randai_is_global_admin());

create policy "randcore_agent_runtime_admin_control"
on public.randcore_agent_runtime for update
to authenticated
using (public.has_any_randapp_admin() or public.randai_is_global_admin())
with check (public.has_any_randapp_admin() or public.randai_is_global_admin());

create index if not exists randcore_agent_runtime_heartbeat_idx on public.randcore_agent_runtime (heartbeat_at desc);
create index if not exists randcore_agent_runtime_hotel_idx on public.randcore_agent_runtime (hotel_id) where hotel_id is not null;

insert into public.randcore_agent_runtime (agent_id, status, desired_state)
values
  ('randai','OFFLINE','RUNNING'),
  ('randradar','OFFLINE','RUNNING'),
  ('randui','OFFLINE','RUNNING'),
  ('randtest','OFFLINE','RUNNING'),
  ('randsecure','OFFLINE','RUNNING'),
  ('randops','OFFLINE','RUNNING'),
  ('randcore','OFFLINE','RUNNING'),
  ('randmind','OFFLINE','RUNNING')
on conflict (agent_id) do nothing;

comment on table public.randcore_agent_runtime is 'Live runtime state and operator intent for canonical Rand agents. Worker/service-role processes own heartbeat/status writes; authenticated admins may read and set desired_state.';
