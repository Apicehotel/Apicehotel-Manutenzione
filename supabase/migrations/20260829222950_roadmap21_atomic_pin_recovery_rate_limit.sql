create or replace function public.consume_pin_recovery_rate_limit(
  p_source_hash text,
  p_window_seconds integer default 1800,
  p_max_attempts integer default 3
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  if p_source_hash is null or length(p_source_hash) < 32 then
    return false;
  end if;

  insert into public.pin_recovery_rate_limits(source_hash, attempts, window_started_at, updated_at)
  values (p_source_hash, 0, v_now, v_now)
  on conflict (source_hash) do nothing;

  select attempts, window_started_at
    into v_attempts, v_started
  from public.pin_recovery_rate_limits
  where source_hash = p_source_hash
  for update;

  if v_started is null or v_now - v_started >= make_interval(secs => greatest(1, p_window_seconds)) then
    update public.pin_recovery_rate_limits
      set attempts = 1, window_started_at = v_now, updated_at = v_now
    where source_hash = p_source_hash;
    return true;
  end if;

  if coalesce(v_attempts, 0) >= greatest(1, p_max_attempts) then
    update public.pin_recovery_rate_limits set updated_at = v_now where source_hash = p_source_hash;
    return false;
  end if;

  update public.pin_recovery_rate_limits
    set attempts = coalesce(v_attempts, 0) + 1, updated_at = v_now
  where source_hash = p_source_hash;
  return true;
end;
$$;

revoke all on function public.consume_pin_recovery_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_pin_recovery_rate_limit(text,integer,integer) to service_role;