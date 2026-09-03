-- Block 22 / points 74-80: promote the existing RandAI knowledge domain into canonical RandGuide.
-- Existing randai_procedures/documents/equipment/guidance_sessions remain the authority.
-- This migration enriches them; it does not create a second knowledge system.

alter table public.randai_procedures
  add column if not exists procedure_kind text not null default 'procedure',
  add column if not exists risk_level text not null default 'normal',
  add column if not exists source_confidence integer not null default 100,
  add column if not exists location_path text[] not null default '{}'::text[],
  add column if not exists equipment_ids text[] not null default '{}'::text[],
  add column if not exists review_due_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists supersedes_id text,
  add column if not exists content_hash text;

alter table public.randai_procedures drop constraint if exists randai_procedures_kind_check;
alter table public.randai_procedures add constraint randai_procedures_kind_check
  check (procedure_kind in ('procedure','location','equipment','emergency','troubleshooting','reference'));
alter table public.randai_procedures drop constraint if exists randai_procedures_risk_check;
alter table public.randai_procedures add constraint randai_procedures_risk_check
  check (risk_level in ('low','normal','high','critical'));
alter table public.randai_procedures drop constraint if exists randai_procedures_source_confidence_check;
alter table public.randai_procedures add constraint randai_procedures_source_confidence_check
  check (source_confidence between 0 and 100);

create table if not exists public.randguide_procedure_versions (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null references public.randai_procedures(id) on delete cascade,
  hotel_id text not null,
  version integer not null,
  snapshot jsonb not null,
  content_hash text,
  change_note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (procedure_id, version)
);

create table if not exists public.randguide_links (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  from_type text not null,
  from_id text not null,
  relation text not null,
  to_type text not null,
  to_id text not null,
  confidence integer not null default 100,
  source text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint randguide_links_confidence_check check (confidence between 0 and 100),
  constraint randguide_links_relation_check check (relation in ('LOCATED_IN','CONTAINS','HAS_EQUIPMENT','HAS_PROCEDURE','USES_DOCUMENT','REFERENCES','RESOLVED_BY')),
  unique (hotel_id, from_type, from_id, relation, to_type, to_id)
);

create index if not exists randguide_versions_hotel_procedure_idx on public.randguide_procedure_versions(hotel_id, procedure_id, version desc);
create index if not exists randguide_links_hotel_from_idx on public.randguide_links(hotel_id, from_type, from_id);
create index if not exists randguide_links_hotel_to_idx on public.randguide_links(hotel_id, to_type, to_id);
create index if not exists randai_procedures_review_due_idx on public.randai_procedures(hotel_id, review_due_at) where status='approved';

alter table public.randguide_procedure_versions enable row level security;
alter table public.randguide_links enable row level security;

revoke all on public.randguide_procedure_versions from anon;
revoke all on public.randguide_links from anon;
grant select, insert on public.randguide_procedure_versions to authenticated;
grant select, insert, update, delete on public.randguide_links to authenticated;

create policy randguide_versions_select on public.randguide_procedure_versions
  for select to authenticated using (public.is_hotel_member(hotel_id) or public.can_manage_randai_hotel(hotel_id));
create policy randguide_versions_insert on public.randguide_procedure_versions
  for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randguide_links_select on public.randguide_links
  for select to authenticated using (public.is_hotel_member(hotel_id) or public.can_manage_randai_hotel(hotel_id));
create policy randguide_links_insert on public.randguide_links
  for insert to authenticated with check (public.can_manage_randai_hotel(hotel_id));
create policy randguide_links_update on public.randguide_links
  for update to authenticated using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy randguide_links_delete on public.randguide_links
  for delete to authenticated using (public.can_manage_randai_hotel(hotel_id));

create or replace function public.randguide_snapshot_procedure_internal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op='UPDATE' and new.version > old.version then
    insert into public.randguide_procedure_versions(procedure_id,hotel_id,version,snapshot,content_hash,created_by)
    values(old.id,old.hotel_id,old.version,to_jsonb(old),old.content_hash,auth.uid())
    on conflict (procedure_id,version) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists randguide_snapshot_procedure on public.randai_procedures;
create trigger randguide_snapshot_procedure
before update on public.randai_procedures
for each row execute function public.randguide_snapshot_procedure_internal();

create or replace function public.randguide_publish_procedure(
  p_procedure_id text,
  p_change_note text default null,
  p_review_due_at timestamptz default null
)
returns public.randai_procedures
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_row public.randai_procedures;
begin
  select * into v_row from public.randai_procedures where id=p_procedure_id for update;
  if not found then raise exception 'procedure_not_found'; end if;
  if not public.can_manage_randai_hotel(v_row.hotel_id) then raise exception 'not_authorized'; end if;
  if coalesce(length(btrim(v_row.title)),0)=0 or coalesce(length(btrim(v_row.summary)),0)=0 then raise exception 'procedure_incomplete'; end if;
  if v_row.procedure_kind not in ('location','reference') and jsonb_array_length(coalesce(v_row.steps,'[]'::jsonb))=0 then raise exception 'procedure_steps_required'; end if;
  if v_row.risk_level='critical' and coalesce(length(btrim(v_row.caution)),0)=0 then raise exception 'critical_caution_required'; end if;
  if v_row.source_confidence < 60 then raise exception 'source_confidence_too_low'; end if;

  update public.randai_procedures
  set status='approved', approved_at=now(), approved_by=auth.uid(), review_due_at=coalesce(p_review_due_at, now()+interval '365 days'), version=greatest(1,version)+1, updated_at=now()
  where id=p_procedure_id returning * into v_row;

  insert into public.randguide_procedure_versions(procedure_id,hotel_id,version,snapshot,content_hash,change_note,created_by)
  values(v_row.id,v_row.hotel_id,v_row.version,to_jsonb(v_row),v_row.content_hash,p_change_note,auth.uid())
  on conflict (procedure_id,version) do update set snapshot=excluded.snapshot, content_hash=excluded.content_hash, change_note=excluded.change_note;
  return v_row;
end;
$$;

revoke all on function public.randguide_publish_procedure(text,text,timestamptz) from public, anon;
grant execute on function public.randguide_publish_procedure(text,text,timestamptz) to authenticated, service_role;

create or replace function public.randguide_get_graph(p_hotel_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case when public.is_hotel_member(p_hotel_id) or public.can_manage_randai_hotel(p_hotel_id) then
    jsonb_build_object(
      'hotel_id',p_hotel_id,
      'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.randguide_links l where l.hotel_id=p_hotel_id),'[]'::jsonb),
      'procedures',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'area',p.area,'equipment_ids',p.equipment_ids,'status',p.status,'version',p.version)) from public.randai_procedures p where p.hotel_id=p_hotel_id and p.status='approved'),'[]'::jsonb),
      'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'category',e.category,'location',e.location)) from public.randai_equipment e where e.hotel_id=p_hotel_id and e.active),'[]'::jsonb)
    )
  else null end;
$$;

revoke all on function public.randguide_get_graph(text) from public, anon;
grant execute on function public.randguide_get_graph(text) to authenticated, service_role;
