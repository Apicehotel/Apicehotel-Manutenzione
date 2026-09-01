create or replace function public.inventory_guard_intervention_delete()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(
    select 1 from public.inventory_intervention_parts p
    where p.hotel_id=old.hotel_id and p.intervention_id=old.id and p.status='consumed'
  ) then
    raise exception 'INTERVENTION_HAS_INVENTORY_HISTORY';
  end if;

  delete from public.inventory_intervention_parts p
  where p.hotel_id=old.hotel_id and p.intervention_id=old.id and p.status<>'consumed';

  return old;
end $$;
