-- Reliability Block 38 — Audit & Reversible Operations
-- Append-only operational audit plus scoped soft-delete/restore for critical domains.

create table if not exists public.operational_audit_log (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  hotel_id text not null,
  actor_user_id uuid,
  actor_role text,
  module text not null,
  action text not null,
  record_type text not null,
  record_id text not null,
  source text not null default 'database',
  outcome text not null default 'succeeded',
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operational_audit_operation_id_chk check (operation_id ~ '^RND-(OP|AUD)-'),
  constraint operational_audit_outcome_chk check (outcome in ('pending','succeeded','failed','blocked'))
);

create index if not exists operational_audit_hotel_created_idx
  on public.operational_audit_log(hotel_id, created_at desc);
create index if not exists operational_audit_operation_idx
  on public.operational_audit_log(operation_id);
create index if not exists operational_audit_record_idx
  on public.operational_audit_log(record_type, record_id, created_at desc);

alter table public.operational_audit_log enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.operational_audit_log from anon, authenticated;
grant select on public.operational_audit_log to authenticated;

drop policy if exists operational_audit_admin_select on public.operational_audit_log;
create policy operational_audit_admin_select
  on public.operational_audit_log for select to authenticated
  using (public.can_admin_hotel(hotel_id));

alter table public.segnalazioni
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid,
  add column if not exists deleted_reason text,
  add column if not exists delete_operation_id text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid,
  add column if not exists restore_operation_id text;

alter table public.interventi
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid,
  add column if not exists deleted_reason text,
  add column if not exists delete_operation_id text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid,
  add column if not exists restore_operation_id text;

alter table public.planning_lavori
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid,
  add column if not exists deleted_reason text,
  add column if not exists delete_operation_id text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid,
  add column if not exists restore_operation_id text;

alter table public.planning_lavori_giorni
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid,
  add column if not exists deleted_reason text,
  add column if not exists delete_operation_id text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid,
  add column if not exists restore_operation_id text;

create index if not exists segnalazioni_active_hotel_idx on public.segnalazioni(hotel_id, creato_il desc) where deleted_at is null;
create index if not exists interventi_active_hotel_idx on public.interventi(hotel_id, creato_il desc) where deleted_at is null;
create index if not exists planning_lavori_active_hotel_idx on public.planning_lavori(hotel_id, creato_il desc) where deleted_at is null;
create index if not exists planning_lavori_giorni_active_hotel_idx on public.planning_lavori_giorni(hotel_id, data) where deleted_at is null;

create or replace function public.audit_redact_operational_state(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case when p_state is null then null else p_state - array['tecnico_telefono'] end;
$$;

revoke all on function public.audit_redact_operational_state(jsonb) from public;
grant execute on function public.audit_redact_operational_state(jsonb) to service_role;

create or replace function public.capture_operational_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end;
  v_state jsonb := coalesce(v_new, v_old);
  v_hotel_id text := v_state->>'hotel_id';
  v_record_id text := v_state->>'id';
  v_actor uuid := auth.uid();
  v_role text;
  v_module text;
  v_action text;
  v_operation_id text;
begin
  v_module := case tg_table_name
    when 'segnalazioni' then 'issues'
    when 'interventi' then 'interventions'
    when 'planning_lavori' then 'planning_work'
    when 'planning_lavori_giorni' then 'planning_work'
    else tg_table_name
  end;

  v_action := lower(tg_op);
  if tg_op = 'UPDATE' then
    if (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then v_action := 'soft_delete';
    elsif (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null then v_action := 'restore';
    else v_action := 'update'; end if;
  elsif tg_op = 'INSERT' then v_action := 'create';
  elsif tg_op = 'DELETE' then v_action := 'hard_delete';
  end if;

  v_operation_id := coalesce(
    nullif(v_new->>'delete_operation_id',''),
    nullif(v_new->>'restore_operation_id',''),
    nullif(v_new->>'mutation_id',''),
    nullif(v_old->>'delete_operation_id',''),
    nullif(v_old->>'restore_operation_id',''),
    nullif(v_old->>'mutation_id',''),
    'RND-AUD-' || replace(gen_random_uuid()::text, '-', '')
  );
  if v_operation_id !~ '^RND-(OP|AUD)-' then
    v_operation_id := 'RND-AUD-' || replace(gen_random_uuid()::text, '-', '');
  end if;

  select hm.role into v_role
  from public.hotel_memberships hm
  where hm.auth_user_id = v_actor and hm.hotel_id = v_hotel_id and hm.active
  limit 1;

  insert into public.operational_audit_log(
    operation_id, hotel_id, actor_user_id, actor_role, module, action,
    record_type, record_id, source, outcome, before_state, after_state,
    metadata
  ) values (
    v_operation_id, v_hotel_id, v_actor, v_role, v_module, v_action,
    tg_table_name, v_record_id, 'database', 'succeeded',
    public.audit_redact_operational_state(v_old),
    public.audit_redact_operational_state(v_new),
    jsonb_build_object('trigger_operation', tg_op)
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_operational_audit() from public, anon, authenticated;

DO $$
declare
  t text;
begin
  foreach t in array array['segnalazioni','interventi','planning_lavori','planning_lavori_giorni']
  loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.capture_operational_audit()', 'audit_' || t, t);
  end loop;
end $$;

create or replace function public.soft_delete_issue(
  p_id uuid, p_hotel_id text, p_operation_id text, p_reason text default null
) returns public.segnalazioni
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.segnalazioni;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  select * into v_row from public.segnalazioni where id=p_id and hotel_id=p_hotel_id for update;
  if not found then raise exception 'Segnalazione non trovata' using errcode='P0002'; end if;
  if v_row.deleted_at is not null then return v_row; end if;
  if not (public.has_app_permission(p_hotel_id,'issues','delete') or (v_row.created_by_user_id=v_uid and public.is_hotel_member(p_hotel_id))) then
    raise exception 'Non autorizzato a eliminare la segnalazione' using errcode='42501';
  end if;
  update public.segnalazioni set
    deleted_at=now(), deleted_by_user_id=v_uid, deleted_reason=nullif(btrim(p_reason),''),
    delete_operation_id=p_operation_id, restored_at=null, restored_by_user_id=null, restore_operation_id=null,
    updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.restore_issue(
  p_id uuid, p_hotel_id text, p_operation_id text
) returns public.segnalazioni
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.segnalazioni;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  select * into v_row from public.segnalazioni where id=p_id and hotel_id=p_hotel_id for update;
  if not found then raise exception 'Segnalazione non trovata' using errcode='P0002'; end if;
  if v_row.deleted_at is null then return v_row; end if;
  if not (public.has_app_permission(p_hotel_id,'issues','delete') or (v_row.created_by_user_id=v_uid and public.is_hotel_member(p_hotel_id))) then
    raise exception 'Non autorizzato a ripristinare la segnalazione' using errcode='42501';
  end if;
  update public.segnalazioni set
    deleted_at=null, deleted_by_user_id=null, deleted_reason=null,
    restored_at=now(), restored_by_user_id=v_uid, restore_operation_id=p_operation_id,
    updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.soft_delete_planning_work_day(
  p_id uuid, p_hotel_id text, p_operation_id text, p_reason text default null
) returns public.planning_lavori_giorni
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_uid uuid:=auth.uid(); v_row public.planning_lavori_giorni;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  if not public.has_app_permission(p_hotel_id,'planning_work','delete') then raise exception 'Non autorizzato' using errcode='42501'; end if;
  update public.planning_lavori_giorni set deleted_at=coalesce(deleted_at,now()), deleted_by_user_id=coalesce(deleted_by_user_id,v_uid),
    deleted_reason=coalesce(deleted_reason,nullif(btrim(p_reason),'')), delete_operation_id=coalesce(delete_operation_id,p_operation_id), updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  if v_row.id is null then raise exception 'Giorno planning non trovato' using errcode='P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.restore_planning_work_day(
  p_id uuid, p_hotel_id text, p_operation_id text
) returns public.planning_lavori_giorni
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_uid uuid:=auth.uid(); v_row public.planning_lavori_giorni;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  if not public.has_app_permission(p_hotel_id,'planning_work','delete') then raise exception 'Non autorizzato' using errcode='42501'; end if;
  update public.planning_lavori_giorni set deleted_at=null, deleted_by_user_id=null, deleted_reason=null,
    restored_at=now(), restored_by_user_id=v_uid, restore_operation_id=p_operation_id, updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  if v_row.id is null then raise exception 'Giorno planning non trovato' using errcode='P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.soft_delete_intervention(
  p_id uuid, p_hotel_id text, p_operation_id text, p_reason text default null
) returns public.interventi
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_uid uuid:=auth.uid(); v_row public.interventi;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  if not public.has_app_permission(p_hotel_id,'interventions','delete') then raise exception 'Non autorizzato' using errcode='42501'; end if;
  update public.interventi set deleted_at=coalesce(deleted_at,now()), deleted_by_user_id=coalesce(deleted_by_user_id,v_uid),
    deleted_reason=coalesce(deleted_reason,nullif(btrim(p_reason),'')), delete_operation_id=coalesce(delete_operation_id,p_operation_id), updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  if v_row.id is null then raise exception 'Intervento non trovato' using errcode='P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.restore_intervention(
  p_id uuid, p_hotel_id text, p_operation_id text
) returns public.interventi
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_uid uuid:=auth.uid(); v_row public.interventi;
begin
  if v_uid is null then raise exception 'Non autenticato' using errcode='28000'; end if;
  if p_operation_id is null or p_operation_id !~ '^RND-OP-' then raise exception 'operation_id non valido' using errcode='22023'; end if;
  if not public.has_app_permission(p_hotel_id,'interventions','delete') then raise exception 'Non autorizzato' using errcode='42501'; end if;
  update public.interventi set deleted_at=null, deleted_by_user_id=null, deleted_reason=null,
    restored_at=now(), restored_by_user_id=v_uid, restore_operation_id=p_operation_id, updated_at=now()
  where id=p_id and hotel_id=p_hotel_id returning * into v_row;
  if v_row.id is null then raise exception 'Intervento non trovato' using errcode='P0002'; end if;
  return v_row;
end;
$$;

revoke all on function public.soft_delete_issue(uuid,text,text,text) from public, anon;
revoke all on function public.restore_issue(uuid,text,text) from public, anon;
revoke all on function public.soft_delete_planning_work_day(uuid,text,text,text) from public, anon;
revoke all on function public.restore_planning_work_day(uuid,text,text) from public, anon;
revoke all on function public.soft_delete_intervention(uuid,text,text,text) from public, anon;
revoke all on function public.restore_intervention(uuid,text,text) from public, anon;
grant execute on function public.soft_delete_issue(uuid,text,text,text) to authenticated;
grant execute on function public.restore_issue(uuid,text,text) to authenticated;
grant execute on function public.soft_delete_planning_work_day(uuid,text,text,text) to authenticated;
grant execute on function public.restore_planning_work_day(uuid,text,text) to authenticated;
grant execute on function public.soft_delete_intervention(uuid,text,text,text) to authenticated;
grant execute on function public.restore_intervention(uuid,text,text) to authenticated;

-- Existing hard DELETE policies remain as emergency/backward-compatible authority,
-- but application data paths are migrated to soft-delete in Block 38.
