create or replace function public.expire_stale_presence()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.utenti
     set in_struttura = false,
         in_struttura_dal = null,
         in_struttura_via = null
   where in_struttura = true
     and (
       in_struttura_dal is null
       or in_struttura_dal <= now() - interval '7 hours 20 minutes'
     );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_stale_presence() from public, anon, authenticated;
grant execute on function public.expire_stale_presence() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'presence-auto-expire-7h20') then
    perform cron.unschedule('presence-auto-expire-7h20');
  end if;
end $$;

select cron.schedule(
  'presence-auto-expire-7h20',
  '* * * * *',
  'select public.expire_stale_presence();'
);
