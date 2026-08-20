-- Remove duplicate unique index; the UNIQUE constraint already covers (auth_user_id, hotel_id)
drop index if exists public.hotel_memberships_user_hotel_unique;

-- Prevent direct RPC execution of SECURITY DEFINER helper functions. They remain usable inside RLS/server-side SQL.
revoke execute on function public.can_admin_hotel(text) from anon, authenticated;
revoke execute on function public.has_hotel_role(text,text[]) from anon, authenticated;
revoke execute on function public.is_hotel_member(text) from anon, authenticated;
revoke execute on function public.issue_attachment_same_hotel(uuid,text) from anon, authenticated;
revoke execute on function public.get_usage_stats() from anon, authenticated;
revoke execute on function public.carica_camere_giorno(text,jsonb) from anon, authenticated;
revoke execute on function public.carica_camere_giorno(text,text,jsonb) from anon, authenticated;

-- Split ALL policies into write-only policies to avoid duplicate SELECT evaluation.
do $$
declare t text;
begin
  foreach t in array array['camere_giorno','camere_lavoro','import_camere','interventi','planning_lavori','prenotazioni_sale','tecnici'] loop
    execute format('drop policy if exists %I_staff_write on public.%I', t, t);
    execute format('create policy %I_staff_insert on public.%I for insert to authenticated with check (public.has_hotel_role(hotel_id, array[''admin'',''responsabile'',''manutentore'']))', t, t);
    execute format('create policy %I_staff_update on public.%I for update to authenticated using (public.has_hotel_role(hotel_id, array[''admin'',''responsabile'',''manutentore''])) with check (public.has_hotel_role(hotel_id, array[''admin'',''responsabile'',''manutentore'']))', t, t);
    execute format('create policy %I_staff_delete on public.%I for delete to authenticated using (public.has_hotel_role(hotel_id, array[''admin'',''responsabile'',''manutentore'']))', t, t);
  end loop;
end $$;

-- planning_lavori_giorni derives hotel permissions through parent planning_lavori.
drop policy if exists planning_lavori_giorni_staff_write on public.planning_lavori_giorni;
create policy planning_lavori_giorni_staff_insert on public.planning_lavori_giorni
for insert to authenticated
with check (exists (
  select 1 from public.planning_lavori p
  where p.id = planning_lavori_giorni.lavoro_id
    and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore'])
));
create policy planning_lavori_giorni_staff_update on public.planning_lavori_giorni
for update to authenticated
using (exists (
  select 1 from public.planning_lavori p
  where p.id = planning_lavori_giorni.lavoro_id
    and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore'])
))
with check (exists (
  select 1 from public.planning_lavori p
  where p.id = planning_lavori_giorni.lavoro_id
    and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore'])
));
create policy planning_lavori_giorni_staff_delete on public.planning_lavori_giorni
for delete to authenticated
using (exists (
  select 1 from public.planning_lavori p
  where p.id = planning_lavori_giorni.lavoro_id
    and public.has_hotel_role(p.hotel_id, array['admin','responsabile','manutentore'])
));
