-- Roadmap 21: identity/role mutations must pass through authenticated Edge Function boundaries.
-- Browser clients retain read access governed by RLS, but cannot directly mutate identity,
-- membership or legacy user authority columns through PostgREST.

revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.hotel_memberships from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.utenti from authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.hotel_memberships to authenticated;
grant select on table public.utenti to authenticated;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.hotel_memberships from anon;
revoke all privileges on table public.utenti from anon;