create table if not exists public.randai_autonomy_policies (
  id text primary key,
  level text not null check (level in ('L0_OBSERVE','L1_SUGGEST','L2_PREPARE','L3_EXECUTE_SAFE','L4_AUTONOMOUS')),
  max_risk text check (max_risk is null or max_risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  allowed_tools jsonb not null default '[]'::jsonb,
  denied_tools jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.randai_action_approvals (
  id text primary key,
  identity text not null,
  tool_id text not null,
  task_id text,
  step_id text,
  status text not null check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  requested_at timestamptz not null,
  decided_at timestamptz,
  expires_at timestamptz,
  decided_by text,
  reason text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists randai_action_approvals_identity_requested_idx on public.randai_action_approvals(identity, requested_at desc);
create index if not exists randai_action_approvals_task_status_idx on public.randai_action_approvals(task_id, status, requested_at desc) where task_id is not null;
create index if not exists randai_action_approvals_status_expiry_idx on public.randai_action_approvals(status, expires_at) where status = 'PENDING';

alter table public.randai_autonomy_policies enable row level security;
alter table public.randai_action_approvals enable row level security;

create policy randai_autonomy_policies_select on public.randai_autonomy_policies for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_autonomy_policies_insert on public.randai_autonomy_policies for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_autonomy_policies_update on public.randai_autonomy_policies for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_autonomy_policies_delete on public.randai_autonomy_policies for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);

create policy randai_action_approvals_select on public.randai_action_approvals for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_action_approvals_insert on public.randai_action_approvals for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_action_approvals_update on public.randai_action_approvals for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_action_approvals_delete on public.randai_action_approvals for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
