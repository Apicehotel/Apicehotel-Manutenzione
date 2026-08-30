drop policy if exists randai_action_gateway_settings_service_only on public.randai_action_gateway_settings;
create policy randai_action_gateway_settings_service_only
  on public.randai_action_gateway_settings
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists randai_action_audit_service_only on public.randai_action_audit;
create policy randai_action_audit_service_only
  on public.randai_action_audit
  for all
  to service_role
  using (true)
  with check (true);
