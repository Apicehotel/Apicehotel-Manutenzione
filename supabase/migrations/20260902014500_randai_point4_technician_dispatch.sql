create extension if not exists pgcrypto;

create table if not exists public.external_technicians (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  name text not null check (length(trim(name)) between 2 and 160),
  phone text not null check (length(trim(phone)) between 6 and 32),
  company text,
  email text,
  notes text,
  active boolean not null default true,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, phone)
);

create table if not exists public.technician_competencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,60}$'),
  label text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.external_technician_competencies (
  technician_id uuid not null references public.external_technicians(id) on delete cascade,
  competency_id uuid not null references public.technician_competencies(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (technician_id, competency_id)
);

create table if not exists public.technician_dispatch_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  issue_id uuid not null references public.segnalazioni(id) on delete restrict,
  technician_id uuid references public.external_technicians(id) on delete restrict,
  intervention_id uuid references public.interventi(id) on delete set null,
  reason text not null check (length(trim(reason)) between 2 and 1200),
  status text not null default 'requested' check (status in ('requested','authorized','rejected','dispatched','in_progress','awaiting_internal_close','closed','cancelled','expired')),
  requested_by_user_id uuid not null,
  requested_by_name text,
  requested_by_role text,
  requested_at timestamptz not null default now(),
  authorized_by_user_id uuid,
  authorized_by_name text,
  authorized_by_role text,
  authorized_at timestamptz,
  authorization_note text,
  rejected_by_user_id uuid,
  rejected_by_name text,
  rejected_by_role text,
  rejected_at timestamptz,
  rejection_reason text,
  dispatched_at timestamptz,
  completed_requested_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists technician_dispatch_one_active_issue_idx
  on public.technician_dispatch_requests(issue_id)
  where status in ('requested','authorized','dispatched','in_progress','awaiting_internal_close');
create index if not exists technician_dispatch_hotel_status_idx on public.technician_dispatch_requests(hotel_id,status,created_at desc);
create index if not exists technician_dispatch_technician_idx on public.technician_dispatch_requests(technician_id,created_at desc);
create index if not exists external_technicians_hotel_active_idx on public.external_technicians(hotel_id,active,name);

alter table public.interventi add column if not exists dispatch_request_id uuid references public.technician_dispatch_requests(id) on delete set null;
create unique index if not exists interventi_dispatch_request_uidx on public.interventi(dispatch_request_id) where dispatch_request_id is not null;

create table if not exists public.technician_intervention_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  request_id uuid not null references public.technician_dispatch_requests(id) on delete cascade,
  issue_id uuid not null references public.segnalazioni(id) on delete restrict,
  technician_id uuid not null references public.external_technicians(id) on delete restrict,
  event_type text not null check (event_type in ('opened','arrival_set','started','note','completion_requested','token_revoked')),
  note text,
  arrival_at timestamptz,
  actor_kind text not null default 'technician' check (actor_kind in ('technician','internal','system')),
  created_at timestamptz not null default now()
);
create index if not exists technician_events_request_time_idx on public.technician_intervention_events(request_id,created_at);

-- New Point 4 links never reuse the legacy technician_access_tokens table because its
-- primary key is auth_user_id and its bearer token is stored in clear text. Existing
-- links remain compatible, while every new dispatch uses a dedicated hash-only token.
create table if not exists public.technician_dispatch_tokens (
  id uuid primary key default gen_random_uuid(),
  dispatch_request_id uuid not null references public.technician_dispatch_requests(id) on delete cascade,
  technician_id uuid not null references public.external_technicians(id) on delete cascade,
  token_hash text not null unique check (length(token_hash)=64),
  token_prefix text not null,
  expires_at timestamptz not null,
  opened_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists technician_dispatch_tokens_active_idx on public.technician_dispatch_tokens(dispatch_request_id,revoked_at,expires_at);

insert into public.technician_competencies(code,label) values
 ('electrical','Elettrico'),('plumbing','Idraulica'),('hvac','Climatizzazione / HVAC'),('refrigeration','Refrigerazione'),
 ('appliances','Attrezzature / Elettrodomestici'),('it_network','Rete / IT'),('locks_access','Serrature / Accessi'),
 ('fire_safety','Antincendio / Sicurezza'),('carpentry','Falegnameria'),('lifts','Ascensori')
on conflict (code) do update set label=excluded.label, active=true;

create or replace function public.technician_is_authority_role(p_role text)
returns boolean language sql immutable as $$
  select lower(trim(coalesce(p_role,''))) in ('direzione','direttore centro congressi','reception');
$$;

create or replace function public.technician_can_request_role(p_role text)
returns boolean language sql immutable as $$
  select lower(trim(coalesce(p_role,''))) in ('manutentore','direzione','direttore centro congressi','reception','admin');
$$;

create or replace function public.technician_membership_role(p_hotel_id text)
returns text language sql stable security definer set search_path=public as $$
  select role from public.hotel_memberships
  where auth_user_id=auth.uid() and hotel_id=p_hotel_id and active=true
  order by created_at desc limit 1;
$$;
revoke all on function public.technician_membership_role(text) from public;
grant execute on function public.technician_membership_role(text) to authenticated;

create or replace function public.technician_manage_directory(
  p_hotel_id text, p_technician_id uuid, p_name text, p_phone text,
  p_company text default null, p_email text default null, p_notes text default null, p_active boolean default true
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_role text; v_id uuid; v_phone text;
begin
  v_role := public.technician_membership_role(p_hotel_id);
  if not (public.technician_is_authority_role(v_role) or lower(coalesce(v_role,''))='admin') then raise exception 'permission_denied' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'invalid_name'; end if;
  v_phone := regexp_replace(trim(coalesce(p_phone,'')),'[^0-9+]','','g');
  if length(v_phone) < 6 then raise exception 'invalid_phone'; end if;
  if p_technician_id is null then
    insert into public.external_technicians(hotel_id,name,phone,company,email,notes,active,created_by_user_id)
    values(p_hotel_id,trim(p_name),v_phone,nullif(trim(coalesce(p_company,'')),''),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_notes,'')),''),coalesce(p_active,true),auth.uid()) returning id into v_id;
  else
    update public.external_technicians set name=trim(p_name),phone=v_phone,company=nullif(trim(coalesce(p_company,'')),''),email=nullif(trim(coalesce(p_email,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),active=coalesce(p_active,true),updated_at=now()
    where id=p_technician_id and hotel_id=p_hotel_id returning id into v_id;
    if v_id is null then raise exception 'technician_not_found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.technician_set_competencies(p_hotel_id text,p_technician_id uuid,p_competency_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
  v_role := public.technician_membership_role(p_hotel_id);
  if not (public.technician_is_authority_role(v_role) or lower(coalesce(v_role,''))='admin') then raise exception 'permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.external_technicians where id=p_technician_id and hotel_id=p_hotel_id) then raise exception 'technician_not_found'; end if;
  delete from public.external_technician_competencies where technician_id=p_technician_id;
  insert into public.external_technician_competencies(technician_id,competency_id)
  select p_technician_id,id from public.technician_competencies where id=any(coalesce(p_competency_ids,'{}'::uuid[])) and active=true;
end $$;

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
  return v_id;
end $$;

create or replace function public.technician_authorize_external(p_request_id uuid,p_technician_id uuid,p_note text default null,p_expires_hours integer default 72)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_req public.technician_dispatch_requests%rowtype; v_issue public.segnalazioni%rowtype; v_tech public.external_technicians%rowtype; v_role text; v_name text; v_raw text; v_hash text; v_intervention uuid; v_exp timestamptz;
begin
  select * into v_req from public.technician_dispatch_requests where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  v_role := public.technician_membership_role(v_req.hotel_id);
  if not public.technician_is_authority_role(v_role) then raise exception 'authorization_role_required' using errcode='42501'; end if;
  if v_req.status not in ('requested','authorized') then raise exception 'request_not_authorizable'; end if;
  select * into v_issue from public.segnalazioni where id=v_req.issue_id and hotel_id=v_req.hotel_id and deleted_at is null;
  if not found or coalesce(v_issue.stato,'')='done' then raise exception 'issue_not_available'; end if;
  select * into v_tech from public.external_technicians where id=p_technician_id and hotel_id=v_req.hotel_id and active=true;
  if not found then raise exception 'technician_not_available'; end if;
  select display_name into v_name from public.profiles where auth_user_id=auth.uid();
  if v_req.intervention_id is null then
    insert into public.interventi(hotel_id,camera,categoria,note,stato,creato_da,created_by_user_id,sezione,dispatch_request_id)
    values(v_req.hotel_id,v_issue.camera,'Tecnico esterno',coalesce(nullif(trim(v_req.reason),''),v_issue.note),'pending',coalesce(v_name,'Autorità'),auth.uid(),'intervento',v_req.id)
    returning id into v_intervention;
  else v_intervention := v_req.intervention_id; end if;
  update public.technician_dispatch_tokens set revoked_at=coalesce(revoked_at,now()),ended_at=coalesce(ended_at,now()) where dispatch_request_id=v_req.id and revoked_at is null;
  v_raw := encode(gen_random_bytes(32),'hex');
  v_hash := encode(digest(v_raw,'sha256'),'hex');
  v_exp := now()+make_interval(hours=>greatest(1,least(coalesce(p_expires_hours,72),168)));
  insert into public.technician_dispatch_tokens(dispatch_request_id,technician_id,token_hash,token_prefix,expires_at)
  values(v_req.id,p_technician_id,v_hash,left(v_raw,8),v_exp);
  update public.technician_dispatch_requests set technician_id=p_technician_id,intervention_id=v_intervention,status='authorized',authorized_by_user_id=auth.uid(),authorized_by_name=coalesce(v_name,'Autorità'),authorized_by_role=v_role,authorized_at=now(),authorization_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=v_req.id;
  update public.segnalazioni set tecnico_id=p_technician_id::text,tecnico_nome=v_tech.name,tecnico_telefono=v_tech.phone,tecnico_richiesto_da=coalesce(v_name,'Autorità'),tecnico_richiesto_il=now(),updated_at=now() where id=v_req.issue_id and hotel_id=v_req.hotel_id;
  return jsonb_build_object('request_id',v_req.id,'issue_id',v_req.issue_id,'hotel_id',v_req.hotel_id,'technician_id',p_technician_id,'technician_name',v_tech.name,'phone',v_tech.phone,'intervention_id',v_intervention,'token',v_raw,'expires_at',v_exp);
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
end $$;

revoke all on function public.technician_manage_directory(text,uuid,text,text,text,text,text,boolean) from public;
revoke all on function public.technician_set_competencies(text,uuid,uuid[]) from public;
revoke all on function public.technician_request_external(text,uuid,text) from public;
revoke all on function public.technician_authorize_external(uuid,uuid,text,integer) from public;
revoke all on function public.technician_reject_external(uuid,text) from public;
grant execute on function public.technician_manage_directory(text,uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.technician_set_competencies(text,uuid,uuid[]) to authenticated;
grant execute on function public.technician_request_external(text,uuid,text) to authenticated;
grant execute on function public.technician_authorize_external(uuid,uuid,text,integer) to authenticated;
grant execute on function public.technician_reject_external(uuid,text) to authenticated;

alter table public.external_technicians enable row level security;
alter table public.technician_competencies enable row level security;
alter table public.external_technician_competencies enable row level security;
alter table public.technician_dispatch_requests enable row level security;
alter table public.technician_intervention_events enable row level security;
alter table public.technician_dispatch_tokens enable row level security;

create policy external_technicians_read on public.external_technicians for select to authenticated using (public.technician_can_request_role(public.technician_membership_role(hotel_id)) or lower(coalesce(public.technician_membership_role(hotel_id),''))='admin');
create policy technician_competencies_read on public.technician_competencies for select to authenticated using (active=true);
create policy external_technician_competencies_read on public.external_technician_competencies for select to authenticated using (exists(select 1 from public.external_technicians t where t.id=technician_id and (public.technician_can_request_role(public.technician_membership_role(t.hotel_id)) or lower(coalesce(public.technician_membership_role(t.hotel_id),''))='admin')));
create policy technician_dispatch_read on public.technician_dispatch_requests for select to authenticated using (public.technician_can_request_role(public.technician_membership_role(hotel_id)) or lower(coalesce(public.technician_membership_role(hotel_id),''))='admin');
create policy technician_events_read on public.technician_intervention_events for select to authenticated using (public.technician_can_request_role(public.technician_membership_role(hotel_id)) or lower(coalesce(public.technician_membership_role(hotel_id),''))='admin');

revoke all on public.technician_dispatch_tokens from authenticated,anon;
revoke insert,update,delete on public.external_technicians,public.external_technician_competencies,public.technician_dispatch_requests,public.technician_intervention_events from authenticated,anon;
grant select on public.external_technicians,public.technician_competencies,public.external_technician_competencies,public.technician_dispatch_requests,public.technician_intervention_events to authenticated;

create or replace function public.sync_technician_dispatch_on_issue_close()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.stato='done' and old.stato is distinct from new.stato then
    update public.technician_dispatch_requests set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now()
      where issue_id=new.id and status='awaiting_internal_close';
    update public.interventi set stato='done',completato_il=coalesce(completato_il,now()),completato_da=coalesce(completato_da,new.completato_da,'RandApp'),updated_at=now()
      where dispatch_request_id in (select id from public.technician_dispatch_requests where issue_id=new.id and status='closed');
    update public.technician_dispatch_tokens set ended_at=coalesce(ended_at,now()),revoked_at=coalesce(revoked_at,now())
      where dispatch_request_id in (select id from public.technician_dispatch_requests where issue_id=new.id and status='closed') and revoked_at is null;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_technician_dispatch_on_issue_close on public.segnalazioni;
create trigger trg_sync_technician_dispatch_on_issue_close after update of stato on public.segnalazioni for each row execute function public.sync_technician_dispatch_on_issue_close();

alter publication supabase_realtime add table public.external_technicians;
alter publication supabase_realtime add table public.external_technician_competencies;
alter publication supabase_realtime add table public.technician_dispatch_requests;
alter publication supabase_realtime add table public.technician_intervention_events;
