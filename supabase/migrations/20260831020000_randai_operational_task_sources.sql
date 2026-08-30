-- Block 29: bind durable RandAI tasks to their RandApp operational source.
-- Existing task state remains canonical; these columns make source lookup and
-- concurrency enforcement database-native without weakening existing RLS.

alter table public.randai_tasks
  add column if not exists source_type text,
  add column if not exists source_id text;

update public.randai_tasks
set
  source_type = coalesce(source_type, state #>> '{metadata,sourceType}'),
  source_id = coalesce(source_id, state #>> '{metadata,sourceId}')
where source_type is null or source_id is null;

create or replace function public.randai_sync_task_source_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.source_type := nullif(new.state #>> '{metadata,sourceType}', '');
  new.source_id := nullif(new.state #>> '{metadata,sourceId}', '');
  return new;
end;
$$;

drop trigger if exists randai_tasks_sync_source_identity on public.randai_tasks;
create trigger randai_tasks_sync_source_identity
before insert or update of state on public.randai_tasks
for each row execute function public.randai_sync_task_source_identity();

alter table public.randai_tasks
  drop constraint if exists randai_tasks_source_identity_pair_check;
alter table public.randai_tasks
  add constraint randai_tasks_source_identity_pair_check
  check ((source_type is null) = (source_id is null));

create index if not exists randai_tasks_source_lookup_idx
  on public.randai_tasks(hotel_id, source_type, source_id, updated_at desc)
  where source_type is not null and source_id is not null;

-- A RandApp object may have historical completed tasks, but never two active
-- supervisors at once. Distributed leases still protect execution inside one task.
create unique index if not exists randai_tasks_one_active_source_idx
  on public.randai_tasks(hotel_id, source_type, source_id)
  where source_type is not null
    and source_id is not null
    and status not in ('SUCCEEDED','FAILED','CANCELLED');
