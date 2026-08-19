-- Apply only after the pin-auth/user-pin/admin-users frontend flow has been verified.
-- Removes direct client access to the legacy public.utenti.pin column while
-- preserving access to the non-secret directory/profile columns.

begin;

revoke select on table public.utenti from anon, authenticated;
revoke insert, update on table public.utenti from anon, authenticated;

-- Explicit column grants make `pin` unreachable through PostgREST clients.
grant select (id, hotel_id, nome, ruolo, reparto, telefono, attivo, system_role, created_at, updated_at)
  on table public.utenti to authenticated;

grant select (id, hotel_id, nome, ruolo, reparto, attivo)
  on table public.utenti to anon;

-- All user mutations, including PIN changes, must go through Edge Functions
-- using their server-side service-role credentials.

commit;
