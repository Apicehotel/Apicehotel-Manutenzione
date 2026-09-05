-- Mantiene identica la semantica della policy UPDATE Segnalazioni,
-- ma evita di rivalutare auth.uid() per ogni riga del piano RLS.

drop policy if exists segnalazioni_permission_update on public.segnalazioni;

create policy segnalazioni_permission_update
on public.segnalazioni
for update
to authenticated
using (
  deleted_at is null
  and (
    public.has_app_permission(hotel_id,'issues','edit')
    or public.has_app_permission(hotel_id,'issues','take_charge')
    or public.has_app_permission(hotel_id,'issues','complete')
    or public.has_app_permission(hotel_id,'issues','assign')
    or (
      created_by_user_id = (select auth.uid())
      and public.has_hotel_role(hotel_id,array['Supremo'])
    )
  )
)
with check (
  deleted_at is null
  and (
    public.has_app_permission(hotel_id,'issues','edit')
    or public.has_app_permission(hotel_id,'issues','take_charge')
    or public.has_app_permission(hotel_id,'issues','complete')
    or public.has_app_permission(hotel_id,'issues','assign')
    or (
      created_by_user_id = (select auth.uid())
      and public.has_hotel_role(hotel_id,array['Supremo'])
    )
  )
);
