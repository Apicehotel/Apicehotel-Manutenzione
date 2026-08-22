-- Ottimizza le policy che rivalutavano auth.uid() per ogni riga
-- sostituendo auth.uid() con (select auth.uid()) cosi' viene valutato una sola volta per query

drop policy if exists events_staff_insert on public.issue_events;
create policy events_staff_insert on public.issue_events for insert to authenticated
with check (
  has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[])
  and actor_user_id = (select auth.uid())
  and issue_attachment_same_hotel(issue_id, hotel_id)
);

drop policy if exists sensori_temperatura_staff_update on public.sensori_temperatura;
create policy sensori_temperatura_staff_update on public.sensori_temperatura for update to authenticated
using (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id = (select auth.uid()) and hm.active and hm.role = any(array['admin','Responsabile','Direzione','manutentore']::text[])))
with check (exists (select 1 from public.hotel_memberships hm where hm.auth_user_id = (select auth.uid()) and hm.active and hm.role = any(array['admin','Responsabile','Direzione','manutentore']::text[])));
