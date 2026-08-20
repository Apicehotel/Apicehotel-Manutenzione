revoke execute on function public.protect_system_membership_row() from public, anon, authenticated;
revoke execute on function public.protect_system_profile_row() from public, anon, authenticated;
revoke execute on function public.protect_system_user_row() from public, anon, authenticated;

revoke select, insert, update, delete on table public.utenti from anon;
revoke select, insert, update, delete on table public.utenti from authenticated;

grant select (
  id,
  nome,
  ruolo,
  hotels,
  puo_admin,
  zone_consentite,
  telefono,
  deve_cambiare_pin,
  in_struttura,
  in_struttura_dal,
  in_struttura_via,
  creato_il,
  department,
  email,
  phone_country_code,
  phone_verified,
  email_verified,
  active,
  is_system_protected
) on table public.utenti to authenticated;
