-- Harden helper/trigger functions
alter function public.set_updated_at() set search_path = public;
alter function public.carica_camere_giorno(text, jsonb) set search_path = public;
alter function public.carica_camere_giorno(text, text, jsonb) set search_path = public;

-- SECURITY DEFINER functions must not be callable anonymously.
revoke execute on function public.carica_camere_giorno(text, jsonb) from anon;
revoke execute on function public.carica_camere_giorno(text, text, jsonb) from anon;
revoke execute on function public.get_usage_stats() from anon;
revoke execute on function public.issue_attachment_same_hotel(uuid, text) from anon;
revoke execute on function public.pulisci_richieste_urgenti_vecchie() from anon;
revoke execute on function public.is_hotel_member(text) from anon;
revoke execute on function public.has_hotel_role(text, text[]) from anon;
revoke execute on function public.can_admin_hotel(text) from anon;

-- Optimize RLS auth.uid() evaluation and remove duplicate SELECT policies.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

drop policy if exists memberships_self_select on public.hotel_memberships;
drop policy if exists memberships_admin_select on public.hotel_memberships;
create policy memberships_visible on public.hotel_memberships
for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or public.can_admin_hotel(hotel_id)
);

drop policy if exists issues_member_insert on public.maintenance_issues;
create policy issues_member_insert on public.maintenance_issues
for insert to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and created_by = (select auth.uid())
);

drop policy if exists attachments_member_insert on public.issue_attachments;
create policy attachments_member_insert on public.issue_attachments
for insert to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and uploaded_by = (select auth.uid())
  and public.issue_attachment_same_hotel(issue_id, hotel_id)
);

-- Fix issue_events hotel validation bug and optimize auth.uid().
drop policy if exists events_staff_insert on public.issue_events;
create policy events_staff_insert on public.issue_events
for insert to authenticated
with check (
  public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])
  and actor_user_id = (select auth.uid())
  and public.issue_attachment_same_hotel(issue_id, hotel_id)
);

-- Cover foreign keys and common filters.
create index if not exists import_camere_hotel_id_idx on public.import_camere(hotel_id);
create index if not exists issue_attachments_hotel_id_idx on public.issue_attachments(hotel_id);
create index if not exists issue_attachments_uploaded_by_idx on public.issue_attachments(uploaded_by);
create index if not exists issue_events_hotel_id_idx on public.issue_events(hotel_id);
create index if not exists issue_events_actor_user_id_idx on public.issue_events(actor_user_id);
create index if not exists maintenance_issues_created_by_idx on public.maintenance_issues(created_by);
create index if not exists maintenance_issues_assigned_to_idx on public.maintenance_issues(assigned_to);
create index if not exists planning_lavori_hotel_id_idx on public.planning_lavori(hotel_id);
create index if not exists tecnici_hotel_id_idx on public.tecnici(hotel_id);
