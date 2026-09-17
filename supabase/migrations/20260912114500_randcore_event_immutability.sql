-- Event IDs are provenance anchors: an existing event may be re-read/reused,
-- but its semantic content must never be rewritten.
create or replace function public.randcore_prevent_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_id is distinct from old.event_id
     or new.type is distinct from old.type
     or new.source is distinct from old.source
     or new.scope is distinct from old.scope
     or new.hotel_id is distinct from old.hotel_id
     or new.occurred_at is distinct from old.occurred_at
     or new.correlation_id is distinct from old.correlation_id
     or new.causation_id is distinct from old.causation_id
     or new.payload is distinct from old.payload then
    raise exception 'RANDCORE_EVENT_IMMUTABLE';
  end if;
  return old;
end;
$$;

drop trigger if exists randcore_events_immutable on public.randcore_events;
create trigger randcore_events_immutable
before update on public.randcore_events
for each row execute function public.randcore_prevent_event_mutation();

revoke all on function public.randcore_prevent_event_mutation() from public, anon, authenticated;
