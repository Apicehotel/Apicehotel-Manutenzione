update public.role_permissions set allowed=false where role='RandAI';
update public.role_permissions set allowed=true where role='RandAI' and action='view' and module in ('home','issues','planning_work','sensors','temperature','users');

drop policy if exists sensori_temperatura_member_select on public.sensori_temperatura;
create policy sensori_temperatura_member_select on public.sensori_temperatura for select to authenticated
using (
  (mostra_hotelgio and (public.is_hotel_member('hotelgio') or public.is_hotel_member('gio')))
  or (mostra_chocohotel and public.is_hotel_member('chocohotel'))
  or (mostra_brigantino and public.is_hotel_member('brigantino'))
);

drop policy if exists sensori_temperatura_admin_update on public.sensori_temperatura;
create policy sensori_temperatura_admin_update on public.sensori_temperatura for update to authenticated
using (
  (mostra_hotelgio and public.can_admin_hotel('hotelgio'))
  or (mostra_chocohotel and public.can_admin_hotel('chocohotel'))
  or (mostra_brigantino and public.can_admin_hotel('brigantino'))
)
with check (
  (not mostra_hotelgio or public.can_admin_hotel('hotelgio'))
  and (not mostra_chocohotel or public.can_admin_hotel('chocohotel'))
  and (not mostra_brigantino or public.can_admin_hotel('brigantino'))
);
