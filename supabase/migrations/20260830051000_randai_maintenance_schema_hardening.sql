create index if not exists randai_knowledge_evidence_procedure_fk_idx
  on public.randai_knowledge_evidence(procedure_id)
  where procedure_id is not null;

create index if not exists randai_knowledge_evidence_equipment_fk_idx
  on public.randai_knowledge_evidence(equipment_id)
  where equipment_id is not null;

drop policy if exists randai_procedure_revisions_member_read on public.randai_procedure_revisions;
drop policy if exists randai_procedure_revisions_admin_manage on public.randai_procedure_revisions;

create policy randai_procedure_revisions_read on public.randai_procedure_revisions
for select to authenticated
using (
  public.can_admin_hotel(hotel_id)
  or (public.is_hotel_member(hotel_id) and trust in ('verified','approved','outdated'))
);

create policy randai_procedure_revisions_admin_insert on public.randai_procedure_revisions
for insert to authenticated
with check (public.can_admin_hotel(hotel_id));

create policy randai_procedure_revisions_admin_update on public.randai_procedure_revisions
for update to authenticated
using (public.can_admin_hotel(hotel_id))
with check (public.can_admin_hotel(hotel_id));

create policy randai_procedure_revisions_admin_delete on public.randai_procedure_revisions
for delete to authenticated
using (public.can_admin_hotel(hotel_id));

drop policy if exists randai_knowledge_evidence_member_read on public.randai_knowledge_evidence;
drop policy if exists randai_knowledge_evidence_admin_manage on public.randai_knowledge_evidence;

create policy randai_knowledge_evidence_read on public.randai_knowledge_evidence
for select to authenticated
using (
  public.can_admin_hotel(hotel_id)
  or (public.is_hotel_member(hotel_id) and trust in ('verified','approved'))
);

create policy randai_knowledge_evidence_admin_insert on public.randai_knowledge_evidence
for insert to authenticated
with check (public.can_admin_hotel(hotel_id));

create policy randai_knowledge_evidence_admin_update on public.randai_knowledge_evidence
for update to authenticated
using (public.can_admin_hotel(hotel_id))
with check (public.can_admin_hotel(hotel_id));

create policy randai_knowledge_evidence_admin_delete on public.randai_knowledge_evidence
for delete to authenticated
using (public.can_admin_hotel(hotel_id));
