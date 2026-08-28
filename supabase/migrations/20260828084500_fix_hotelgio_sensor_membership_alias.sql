-- The canonical Hotel Giò id in production is `hotelgio`. Keep the legacy `gio`
-- alias readable during migration, but make the live membership id authoritative.
drop policy if exists sensori_temperatura_member_select on public.sensori_temperatura;
create policy sensori_temperatura_member_select
  on public.sensori_temperatura for select to authenticated
  using (
    exists (
      select 1 from public.hotel_memberships hm
      where hm.auth_user_id = auth.uid() and hm.active
        and (
          hm.can_access_admin
          or (hm.hotel_id in ('gio','hotelgio') and mostra_hotelgio)
          or (hm.hotel_id = 'chocohotel' and mostra_chocohotel)
          or (hm.hotel_id = 'brigantino' and mostra_brigantino)
        )
    )
  );
