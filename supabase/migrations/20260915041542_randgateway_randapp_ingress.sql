-- Close the remaining browser/RandAI bypass: RandApp actions now enter through
-- the canonical RandGateway before the existing Action Gateway executor.

alter table public.rand_gateway_envelopes
  drop constraint if exists rand_gateway_envelopes_channel_check;

alter table public.rand_gateway_envelopes
  add constraint rand_gateway_envelopes_channel_check
  check (channel in ('randapp','randchat','whatsapp','email','mcp','system')) not valid;

alter table public.rand_gateway_envelopes
  validate constraint rand_gateway_envelopes_channel_check;

alter table public.rand_gateway_tool_policies
  drop constraint if exists rand_gateway_tool_policies_channel_check;

alter table public.rand_gateway_tool_policies
  add constraint rand_gateway_tool_policies_channel_check
  check (channel in ('randapp','randchat','whatsapp','email','mcp','system')) not valid;

alter table public.rand_gateway_tool_policies
  validate constraint rand_gateway_tool_policies_channel_check;

insert into public.rand_gateway_tool_policies(
  channel,server_id,tool_name,permission,risk,required_scopes,hotel_scoped,requires_hitl,enabled,executor
) values
  ('randapp','internal','issue.update_priority','WRITE','MEDIUM',array['issues:edit'],true,true,true,'randai_action_gateway'),
  ('randapp','internal','issue.set_waiting_part','WRITE_PROTECTED','MEDIUM',array['issues:take_charge'],true,true,true,'randai_action_gateway'),
  ('randapp','internal','issue.mark_done','WRITE_PROTECTED','HIGH',array['issues:complete'],true,true,true,'randai_action_gateway')
on conflict(channel,server_id,tool_name) do update set
  permission=excluded.permission,
  risk=excluded.risk,
  required_scopes=excluded.required_scopes,
  hotel_scoped=excluded.hotel_scoped,
  requires_hitl=excluded.requires_hitl,
  enabled=excluded.enabled,
  executor=excluded.executor,
  updated_at=now();
