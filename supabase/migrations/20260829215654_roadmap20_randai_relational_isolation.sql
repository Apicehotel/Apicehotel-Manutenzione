-- Punto 20: integrità relazionale multi-hotel RandAI.
-- I controlli preliminari hanno confermato zero record cross-hotel esistenti.

create unique index if not exists randai_equipment_id_hotel_uidx on public.randai_equipment (id, hotel_id);
create unique index if not exists randai_documents_id_hotel_uidx on public.randai_documents (id, hotel_id);
create unique index if not exists randai_procedures_id_hotel_uidx on public.randai_procedures (id, hotel_id);

create index if not exists randai_documents_equipment_hotel_idx on public.randai_documents (equipment_id, hotel_id);
create index if not exists randai_documents_procedure_hotel_idx on public.randai_documents (procedure_id, hotel_id);
create index if not exists randai_memory_equipment_hotel_idx on public.randai_memory (equipment_id, hotel_id);
create index if not exists randai_sensor_bindings_equipment_hotel_idx on public.randai_sensor_bindings (equipment_id, hotel_id);
create index if not exists randai_document_chunks_document_hotel_idx on public.randai_document_chunks (document_id, hotel_id);

alter table public.randai_documents
  drop constraint if exists randai_documents_equipment_id_fkey,
  add constraint randai_documents_equipment_hotel_fkey foreign key (equipment_id, hotel_id)
    references public.randai_equipment (id, hotel_id) on delete set null (equipment_id);

alter table public.randai_documents
  drop constraint if exists randai_documents_procedure_id_fkey,
  add constraint randai_documents_procedure_hotel_fkey foreign key (procedure_id, hotel_id)
    references public.randai_procedures (id, hotel_id) on delete cascade;

alter table public.randai_memory
  drop constraint if exists randai_memory_equipment_id_fkey,
  add constraint randai_memory_equipment_hotel_fkey foreign key (equipment_id, hotel_id)
    references public.randai_equipment (id, hotel_id) on delete set null (equipment_id);

alter table public.randai_sensor_bindings
  drop constraint if exists randai_sensor_bindings_equipment_id_fkey,
  add constraint randai_sensor_bindings_equipment_hotel_fkey foreign key (equipment_id, hotel_id)
    references public.randai_equipment (id, hotel_id) on delete set null (equipment_id);

alter table public.randai_document_chunks
  drop constraint if exists randai_document_chunks_document_id_fkey,
  add constraint randai_document_chunks_document_hotel_fkey foreign key (document_id, hotel_id)
    references public.randai_documents (id, hotel_id) on delete cascade;
