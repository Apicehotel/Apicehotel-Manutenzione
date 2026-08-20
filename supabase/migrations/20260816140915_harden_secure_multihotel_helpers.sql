revoke all on function public.is_hotel_member(text) from public, anon;
revoke all on function public.has_hotel_role(text, text[]) from public, anon;
revoke all on function public.can_admin_hotel(text) from public, anon;
grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_hotel_role(text, text[]) to authenticated;
grant execute on function public.can_admin_hotel(text) to authenticated;
