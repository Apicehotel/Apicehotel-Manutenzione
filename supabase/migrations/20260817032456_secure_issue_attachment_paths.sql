alter table public.issue_attachments
  drop constraint if exists issue_attachments_storage_path_matches_issue;

alter table public.issue_attachments
  add constraint issue_attachments_storage_path_matches_issue
  check (
    storage_path like hotel_id || '/' || issue_id::text || '/%'
  );

create or replace function public.issue_attachment_same_hotel(p_issue_id uuid, p_hotel_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maintenance_issues i
    where i.id = p_issue_id
      and i.hotel_id = p_hotel_id
  );
$$;

revoke all on function public.issue_attachment_same_hotel(uuid,text) from public;
grant execute on function public.issue_attachment_same_hotel(uuid,text) to authenticated;
