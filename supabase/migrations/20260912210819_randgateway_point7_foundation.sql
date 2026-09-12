-- Punto 7: RandGateway is the only authority-neutral ingress for channels.
-- Adapters describe origin and payload; identity, tool policy, HITL, action
-- execution and audit remain independent server-side boundaries.

create table public.rand_gateway_envelopes (
  id uuid primary key,
  trace_id text not null,
  envelope_version smallint not null default 1 check (envelope_version = 1),
  channel text not null check (channel in ('randchat','whatsapp','email','mcp','system')),
  direction text not null check (direction in ('inbound','outbound')),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_external_id text,
  hotel_id text references public.hotels(id) on delete restrict,
  role_id text,
  conversation jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  security jsonb not null default '{"authenticated":false,"identityConfidence":"none","riskLevel":"UNKNOWN","hitlRequired":true}'::jsonb,
  origin jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','accepted','pending','authorized','executed','rejected','failed')),
  idempotency_key text not null unique,
  result jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index rand_gateway_envelopes_hotel_received_idx
  on public.rand_gateway_envelopes(hotel_id, received_at desc);
create index rand_gateway_envelopes_channel_status_idx
  on public.rand_gateway_envelopes(channel, status, received_at desc);
create index rand_gateway_envelopes_actor_idx
  on public.rand_gateway_envelopes(actor_auth_user_id, received_at desc)
  where actor_auth_user_id is not null;

create table public.rand_gateway_audit (
  id bigint generated always as identity primary key,
  envelope_id uuid not null references public.rand_gateway_envelopes(id) on delete restrict,
  hotel_id text references public.hotels(id) on delete restrict,
  stage text not null check (stage in ('ingress','identity','message','tool_gateway','hitl','action_gateway','egress','error')),
  decision text not null check (decision in ('accepted','allowed','pending','executed','denied','failed')),
  code text not null,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index rand_gateway_audit_envelope_idx on public.rand_gateway_audit(envelope_id, occurred_at);
create index rand_gateway_audit_hotel_idx on public.rand_gateway_audit(hotel_id, occurred_at desc);

-- External identities are linked only after an explicit verification flow.
-- The subject is a keyed hash created server-side; phone numbers are not stored here.
create table public.rand_gateway_external_identities (
  channel text not null check (channel in ('whatsapp','email','mcp')),
  external_subject_hash text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  active boolean not null default true,
  verified_at timestamptz not null,
  verified_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(channel, external_subject_hash, hotel_id)
);
create index rand_gateway_external_identity_user_idx
  on public.rand_gateway_external_identities(auth_user_id, hotel_id) where active;

-- Rand's classification is canonical. MCP annotations never override it.
create table public.rand_gateway_tool_policies (
  channel text not null check (channel in ('randchat','whatsapp','email','mcp','system')),
  server_id text not null default 'internal',
  tool_name text not null check (tool_name ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  permission text not null check (permission in ('READ','WRITE','WRITE_PROTECTED','ADMIN')),
  risk text not null check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  required_scopes text[] not null default '{}',
  hotel_scoped boolean not null default true,
  requires_hitl boolean not null default true,
  enabled boolean not null default false,
  executor text not null check (executor in ('randai_action_gateway','randchat','internal_read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(channel, server_id, tool_name)
);

create table public.rand_mcp_servers (
  id text primary key check (id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  label text not null,
  endpoint_url text check (endpoint_url is null or endpoint_url ~ '^https://'),
  transport text not null default 'streamable_http' check (transport in ('streamable_http','stdio')),
  enabled boolean not null default false,
  allowed_hotel_ids text[] not null default '{}',
  auth_secret_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rand_mcp_servers(id,label,transport,enabled,allowed_hotel_ids)
values ('rand-internal','Rand internal MCP','streamable_http',true,array['hotelgio','chocohotel','brigantino'])
on conflict(id) do update set label=excluded.label,transport=excluded.transport,allowed_hotel_ids=excluded.allowed_hotel_ids;

insert into public.rand_gateway_tool_policies(
  channel,server_id,tool_name,permission,risk,required_scopes,hotel_scoped,requires_hitl,enabled,executor
) values
  ('randchat','internal','issue.update_priority','WRITE','MEDIUM',array['issues:edit'],true,true,true,'randai_action_gateway'),
  ('randchat','internal','issue.set_waiting_part','WRITE_PROTECTED','MEDIUM',array['issues:take_charge'],true,true,true,'randai_action_gateway'),
  ('randchat','internal','issue.mark_done','WRITE_PROTECTED','HIGH',array['issues:complete'],true,true,true,'randai_action_gateway'),
  ('mcp','rand-internal','issue.update_priority','WRITE','MEDIUM',array['issues:edit'],true,true,true,'randai_action_gateway'),
  ('mcp','rand-internal','issue.set_waiting_part','WRITE_PROTECTED','MEDIUM',array['issues:take_charge'],true,true,true,'randai_action_gateway'),
  ('mcp','rand-internal','issue.mark_done','WRITE_PROTECTED','HIGH',array['issues:complete'],true,true,true,'randai_action_gateway'),
  ('whatsapp','twilio','issue.update_priority','WRITE','MEDIUM',array['issues:edit'],true,true,false,'randai_action_gateway'),
  ('whatsapp','twilio','issue.set_waiting_part','WRITE_PROTECTED','MEDIUM',array['issues:take_charge'],true,true,false,'randai_action_gateway'),
  ('whatsapp','twilio','issue.mark_done','WRITE_PROTECTED','HIGH',array['issues:complete'],true,true,false,'randai_action_gateway')
on conflict(channel,server_id,tool_name) do update set
  permission=excluded.permission,risk=excluded.risk,required_scopes=excluded.required_scopes,
  hotel_scoped=excluded.hotel_scoped,requires_hitl=excluded.requires_hitl,executor=excluded.executor;

-- Durable queue abstraction. Business code never depends directly on a queue vendor.
create table public.rand_gateway_queue (
  id bigint generated always as identity primary key,
  envelope_id uuid not null references public.rand_gateway_envelopes(id) on delete cascade,
  queue_name text not null default 'rand_gateway',
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(queue_name,envelope_id)
);
create index rand_gateway_queue_claim_idx on public.rand_gateway_queue(queue_name,status,available_at,id);

alter table public.rand_gateway_envelopes enable row level security;
alter table public.rand_gateway_audit enable row level security;
alter table public.rand_gateway_external_identities enable row level security;
alter table public.rand_gateway_tool_policies enable row level security;
alter table public.rand_mcp_servers enable row level security;
alter table public.rand_gateway_queue enable row level security;

revoke all on public.rand_gateway_envelopes from public,anon,authenticated;
revoke all on public.rand_gateway_audit from public,anon,authenticated;
revoke all on public.rand_gateway_external_identities from public,anon,authenticated;
revoke all on public.rand_gateway_tool_policies from public,anon,authenticated;
revoke all on public.rand_mcp_servers from public,anon,authenticated;
revoke all on public.rand_gateway_queue from public,anon,authenticated;
grant select,insert,update on public.rand_gateway_envelopes to service_role;
grant select,insert on public.rand_gateway_audit to service_role;
grant select,insert,update,delete on public.rand_gateway_external_identities to service_role;
grant select,insert,update,delete on public.rand_gateway_tool_policies to service_role;
grant select,insert,update,delete on public.rand_mcp_servers to service_role;
grant select,insert,update,delete on public.rand_gateway_queue to service_role;

create or replace function public.rand_gateway_audit_immutable()
returns trigger language plpgsql security invoker set search_path=public,pg_catalog as $$
begin
  raise exception 'rand_gateway_audit is append-only';
end;
$$;
create trigger rand_gateway_audit_no_mutation
before update or delete on public.rand_gateway_audit
for each row execute function public.rand_gateway_audit_immutable();
revoke all on function public.rand_gateway_audit_immutable() from public,anon,authenticated;
grant execute on function public.rand_gateway_audit_immutable() to service_role;

-- Private Broadcast topics use membership checks, while Postgres remains the
-- source of truth. Clients are never permitted to publish directly.
drop policy if exists randchat_gateway_private_broadcast_read on realtime.messages;
create policy randchat_gateway_private_broadcast_read on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and (
    (
      (select realtime.topic()) ~ '^randchat:group:[0-9a-f-]{36}:messages$'
      and public.chat_group_member(split_part((select realtime.topic()),':',3)::uuid,(select auth.uid()))
    ) or (
      (select realtime.topic()) ~ '^randchat:dm:[0-9a-f-]{36}:messages$'
      and public.chat_dm_participant(split_part((select realtime.topic()),':',3)::uuid,(select auth.uid()))
    )
  )
);

create or replace function public.randchat_broadcast_message_change()
returns trigger language plpgsql security definer set search_path=public,realtime,pg_catalog as $$
declare v_group_id uuid := case when tg_op='DELETE' then old.group_id else new.group_id end;
begin
  perform realtime.broadcast_changes(
    'randchat:group:' || v_group_id::text || ':messages',
    tg_op,tg_op,tg_table_name,tg_table_schema,new,old
  );
  return null;
end;
$$;
revoke all on function public.randchat_broadcast_message_change() from public,anon,authenticated;
grant execute on function public.randchat_broadcast_message_change() to service_role;
create trigger randchat_group_message_broadcast
after insert or update or delete on public.chat_messages
for each row execute function public.randchat_broadcast_message_change();

create or replace function public.randchat_broadcast_dm_change()
returns trigger language plpgsql security definer set search_path=public,realtime,pg_catalog as $$
declare v_thread_id uuid := case when tg_op='DELETE' then old.thread_id else new.thread_id end;
begin
  perform realtime.broadcast_changes(
    'randchat:dm:' || v_thread_id::text || ':messages',
    tg_op,tg_op,tg_table_name,tg_table_schema,new,old
  );
  return null;
end;
$$;
revoke all on function public.randchat_broadcast_dm_change() from public,anon,authenticated;
grant execute on function public.randchat_broadcast_dm_change() to service_role;
create trigger randchat_dm_message_broadcast
after insert or update or delete on public.chat_dm_messages
for each row execute function public.randchat_broadcast_dm_change();

comment on table public.rand_gateway_envelopes is 'Canonical ingress records. Adapters cannot assign authorization or execution authority.';
comment on table public.rand_gateway_audit is 'Append-only decisions across identity, Tool Gateway, HITL and Action Gateway.';
comment on table public.rand_gateway_tool_policies is 'Canonical Rand policy; external MCP annotations are untrusted metadata only.';
comment on table public.rand_gateway_queue is 'Provider-neutral durable queue behind the RandQueue contract.';
