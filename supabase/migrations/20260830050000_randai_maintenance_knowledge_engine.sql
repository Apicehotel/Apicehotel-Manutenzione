create table if not exists public.randai_procedure_revisions (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null references public.randai_procedures(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  version integer not null check (version > 0),
  trust text not null default 'draft' check (trust in ('draft','verified','approved','outdated')),
  change_note text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (procedure_id, version, trust, created_at)
);

create table if not exists public.randai_knowledge_evidence (
  id text primary key,
  hotel_id text not null references public.hotels(id) on delete cascade,
  procedure_id text references public.randai_procedures(id) on delete cascade,
  equipment_id text references public.randai_equipment(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('photo','document','manual','staff_confirmation','issue','intervention','other')),
  label text not null,
  uri text,
  metadata jsonb not null default '{}'::jsonb,
  trust text not null default 'draft' check (trust in ('draft','verified','approved','outdated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint randai_knowledge_evidence_target check (procedure_id is not null or equipment_id is not null)
);

create index if not exists randai_procedure_revisions_lookup_idx on public.randai_procedure_revisions(hotel_id, procedure_id, version desc);
create index if not exists randai_knowledge_evidence_procedure_idx on public.randai_knowledge_evidence(hotel_id, procedure_id) where procedure_id is not null;
create index if not exists randai_knowledge_evidence_equipment_idx on public.randai_knowledge_evidence(hotel_id, equipment_id) where equipment_id is not null;

alter table public.randai_procedure_revisions enable row level security;
alter table public.randai_knowledge_evidence enable row level security;

drop policy if exists randai_procedure_revisions_member_read on public.randai_procedure_revisions;
create policy randai_procedure_revisions_member_read on public.randai_procedure_revisions
for select to authenticated
using (public.is_hotel_member(hotel_id) and trust in ('verified','approved','outdated'));

drop policy if exists randai_procedure_revisions_admin_manage on public.randai_procedure_revisions;
create policy randai_procedure_revisions_admin_manage on public.randai_procedure_revisions
for all to authenticated
using (public.can_admin_hotel(hotel_id))
with check (public.can_admin_hotel(hotel_id));

drop policy if exists randai_knowledge_evidence_member_read on public.randai_knowledge_evidence;
create policy randai_knowledge_evidence_member_read on public.randai_knowledge_evidence
for select to authenticated
using (public.is_hotel_member(hotel_id) and trust in ('verified','approved'));

drop policy if exists randai_knowledge_evidence_admin_manage on public.randai_knowledge_evidence;
create policy randai_knowledge_evidence_admin_manage on public.randai_knowledge_evidence
for all to authenticated
using (public.can_admin_hotel(hotel_id))
with check (public.can_admin_hotel(hotel_id));

insert into public.randai_procedure_revisions(procedure_id, hotel_id, version, trust, change_note, snapshot)
select p.id, p.hotel_id, p.version,
  case p.status when 'approved' then 'approved' when 'archived' then 'outdated' else 'draft' end,
  'Backfill della versione esistente prima del Maintenance Knowledge Engine',
  jsonb_build_object(
    'id', p.id,
    'hotelId', p.hotel_id,
    'title', p.title,
    'category', p.category,
    'area', p.area,
    'symptom', p.symptom,
    'summary', p.summary,
    'keywords', p.keywords,
    'steps', p.steps,
    'caution', p.caution,
    'sourceLabel', p.source_label,
    'version', p.version,
    'approvedAt', p.approved_at
  )
from public.randai_procedures p
where not exists (
  select 1 from public.randai_procedure_revisions r
  where r.procedure_id = p.id and r.version = p.version and r.trust = case p.status when 'approved' then 'approved' when 'archived' then 'outdated' else 'draft' end
);
