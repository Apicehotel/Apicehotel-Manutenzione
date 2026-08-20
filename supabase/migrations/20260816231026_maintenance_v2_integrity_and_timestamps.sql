create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_maintenance_issues_updated_at on public.maintenance_issues;
create trigger trg_maintenance_issues_updated_at
before update on public.maintenance_issues
for each row execute function public.set_updated_at();

alter table public.issue_attachments
  add constraint issue_attachments_storage_path_not_blank check (length(trim(storage_path)) > 0) not valid;
alter table public.issue_attachments validate constraint issue_attachments_storage_path_not_blank;

create unique index if not exists issue_attachments_storage_path_uidx
  on public.issue_attachments(storage_path);

create index if not exists maintenance_issues_hotel_status_created_idx
  on public.maintenance_issues(hotel_id, status, created_at desc);
create index if not exists maintenance_issues_hotel_priority_created_idx
  on public.maintenance_issues(hotel_id, priority, created_at desc);
create index if not exists issue_attachments_issue_created_idx
  on public.issue_attachments(issue_id, created_at desc);

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

drop policy if exists attachments_member_insert on public.issue_attachments;
create policy attachments_member_insert
on public.issue_attachments
for insert
to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and uploaded_by = auth.uid()
  and public.issue_attachment_same_hotel(issue_id, hotel_id)
);
