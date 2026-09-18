alter table public.randcore_agent_runtime
  drop constraint if exists randcore_agent_runtime_known_agent;

alter table public.randcore_agent_runtime
  add constraint randcore_agent_runtime_known_agent
  check (agent_id in (
    'randai','randbrain','randcore','randmind','randradar',
    'randresearch','randsecure','randtest','randops','randui'
  ));

insert into public.randcore_agent_runtime (agent_id, status, desired_state)
values
  ('randbrain','OFFLINE','RUNNING'),
  ('randresearch','OFFLINE','RUNNING')
on conflict (agent_id) do nothing;

comment on constraint randcore_agent_runtime_known_agent on public.randcore_agent_runtime is
'Only executable Rand runtime units receive heartbeat/status rows. Non-runtime Rand components stay in the ecosystem registry and do not fake online/offline state.';
