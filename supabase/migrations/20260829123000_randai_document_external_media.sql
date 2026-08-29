alter table public.randai_documents
  add column if not exists external_url text,
  add column if not exists media_kind text not null default 'document'
    check (media_kind in ('document','image','video','link'));

comment on column public.randai_documents.external_url is 'External approved source URL, e.g. Google Drive/Docs. Kept separate from Supabase storage_path.';
comment on column public.randai_documents.media_kind is 'Presentation kind for RandAI knowledge source: document, image, video, or link.';

create index if not exists randai_documents_hotel_media_idx
  on public.randai_documents (hotel_id, media_kind, status);
