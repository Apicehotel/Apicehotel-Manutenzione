-- Fix attachment RLS and provision private maintenance photo storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.issue_attachments enable row level security;

drop policy if exists attachments_member_insert on public.issue_attachments;
create policy attachments_member_insert
on public.issue_attachments
for insert
to authenticated
with check (
  is_hotel_member(hotel_id)
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.maintenance_issues i
    where i.id = issue_attachments.issue_id
      and i.hotel_id = issue_attachments.hotel_id
  )
);

drop policy if exists maintenance_photos_select on storage.objects;
create policy maintenance_photos_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'maintenance-photos'
  and public.is_hotel_member((storage.foldername(name))[1])
);

drop policy if exists maintenance_photos_insert on storage.objects;
create policy maintenance_photos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'maintenance-photos'
  and public.is_hotel_member((storage.foldername(name))[1])
  and owner_id = auth.uid()::text
);

drop policy if exists maintenance_photos_update on storage.objects;
create policy maintenance_photos_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'maintenance-photos'
  and public.is_hotel_member((storage.foldername(name))[1])
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'maintenance-photos'
  and public.is_hotel_member((storage.foldername(name))[1])
  and owner_id = auth.uid()::text
);

drop policy if exists maintenance_photos_delete on storage.objects;
create policy maintenance_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'maintenance-photos'
  and (
    owner_id = auth.uid()::text
    or public.has_hotel_role((storage.foldername(name))[1], array['admin','responsabile','manutentore'])
  )
);
