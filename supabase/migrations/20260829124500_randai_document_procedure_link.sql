alter table public.randai_documents
  add column if not exists procedure_id text references public.randai_procedures(id) on delete cascade;

create index if not exists randai_documents_procedure_idx
  on public.randai_documents (procedure_id, status);

create unique index if not exists randai_documents_procedure_external_unique
  on public.randai_documents (procedure_id, external_url)
  where procedure_id is not null and external_url is not null;

comment on column public.randai_documents.procedure_id is 'Optional RandAI procedure/knowledge record this document or media enriches.';
