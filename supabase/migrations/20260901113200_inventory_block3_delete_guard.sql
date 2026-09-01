create or replace function public.inventory_guard_intervention_delete()
returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.inventory_intervention_parts p where p.hotel_id=old.hotel_id and p.intervention_id=old.id) then
    raise exception 'INTERVENTION_HAS_INVENTORY_HISTORY';
  end if;
  return old;
end $$;

drop trigger if exists trg_inventory_guard_intervention_delete on public.interventi;
create trigger trg_inventory_guard_intervention_delete before delete on public.interventi for each row execute function public.inventory_guard_intervention_delete();
