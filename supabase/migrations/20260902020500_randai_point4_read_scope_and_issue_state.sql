-- RandAI can observe Point 4, but it receives no dispatch mutation privileges.
drop policy if exists external_technicians_read on public.external_technicians;
create policy external_technicians_read on public.external_technicians for select to authenticated
using (public.technician_can_request_role(public.technician_membership_role(hotel_id))
  or lower(coalesce(public.technician_membership_role(hotel_id),'')) in ('admin','randai'));

drop policy if exists external_technician_competencies_read on public.external_technician_competencies;
create policy external_technician_competencies_read on public.external_technician_competencies for select to authenticated
using (exists(select 1 from public.external_technicians t where t.id=technician_id
  and (public.technician_can_request_role(public.technician_membership_role(t.hotel_id))
    or lower(coalesce(public.technician_membership_role(t.hotel_id),'')) in ('admin','randai'))));

drop policy if exists technician_dispatch_read on public.technician_dispatch_requests;
create policy technician_dispatch_read on public.technician_dispatch_requests for select to authenticated
using (public.technician_can_request_role(public.technician_membership_role(hotel_id))
  or lower(coalesce(public.technician_membership_role(hotel_id),'')) in ('admin','randai'));

drop policy if exists technician_events_read on public.technician_intervention_events;
create policy technician_events_read on public.technician_intervention_events for select to authenticated
using (public.technician_can_request_role(public.technician_membership_role(hotel_id))
  or lower(coalesce(public.technician_membership_role(hotel_id),'')) in ('admin','randai'));

-- A technician request is itself a domain transition: it moves the issue to the
-- existing 'tecnico' state without granting the requester authorization powers.
create or replace function public.technician_request_external(p_hotel_id text,p_issue_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_role text; v_name text; v_id uuid;
begin
  v_role := public.technician_membership_role(p_hotel_id);
  if not public.technician_can_request_role(v_role) then raise exception 'permission_denied' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,''))) < 2 then raise exception 'reason_required'; end if;
  if not exists(select 1 from public.segnalazioni where id=p_issue_id and hotel_id=p_hotel_id and coalesce(stato,'')<>'done' and deleted_at is null) then raise exception 'issue_not_available'; end if;
  select display_name into v_name from public.profiles where auth_user_id=auth.uid();
  select id into v_id from public.technician_dispatch_requests where issue_id=p_issue_id and status in ('requested','authorized','dispatched','in_progress','awaiting_internal_close') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.technician_dispatch_requests(hotel_id,issue_id,reason,requested_by_user_id,requested_by_name,requested_by_role)
  values(p_hotel_id,p_issue_id,trim(p_reason),auth.uid(),coalesce(v_name,'Utente RandApp'),v_role) returning id into v_id;
  update public.segnalazioni set stato='tecnico', tecnico_chiesto_da=coalesce(v_name,'Utente RandApp'), tecnico_chiesto_il=now(), updated_at=now()
    where id=p_issue_id and hotel_id=p_hotel_id;
  return v_id;
end $$;

create or replace function public.technician_reject_external(p_request_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_req public.technician_dispatch_requests%rowtype; v_role text; v_name text;
begin
  select * into v_req from public.technician_dispatch_requests where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  v_role := public.technician_membership_role(v_req.hotel_id);
  if not public.technician_is_authority_role(v_role) then raise exception 'authorization_role_required' using errcode='42501'; end if;
  if v_req.status <> 'requested' then raise exception 'request_not_rejectable'; end if;
  if length(trim(coalesce(p_reason,'')))<2 then raise exception 'reason_required'; end if;
  select display_name into v_name from public.profiles where auth_user_id=auth.uid();
  update public.technician_dispatch_requests set status='rejected',rejected_by_user_id=auth.uid(),rejected_by_name=coalesce(v_name,'Autorità'),rejected_by_role=v_role,rejected_at=now(),rejection_reason=trim(p_reason),updated_at=now() where id=p_request_id;
  update public.segnalazioni set stato='todo', tecnico_id=null, tecnico_nome=null, tecnico_telefono=null, updated_at=now()
    where id=v_req.issue_id and hotel_id=v_req.hotel_id and stato='tecnico';
end $$;
