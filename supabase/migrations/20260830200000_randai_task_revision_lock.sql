alter table public.randai_tasks
  add column if not exists revision bigint not null default 0 check (revision >= 0);

create index if not exists randai_tasks_revision_idx
  on public.randai_tasks(id, revision);
