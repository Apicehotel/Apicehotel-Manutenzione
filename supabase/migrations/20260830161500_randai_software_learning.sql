create table if not exists public.randai_learning_candidates (
  id text primary key,
  fingerprint text not null unique,
  problem_class text not null,
  status text not null check (status in ('OBSERVED','CANDIDATE','EVALUATING','TESTED','REJECTED')),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  candidate jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists randai_learning_candidates_status_updated_idx on public.randai_learning_candidates(status, updated_at desc);
create index if not exists randai_learning_candidates_problem_idx on public.randai_learning_candidates(problem_class, updated_at desc);

alter table public.randai_learning_candidates enable row level security;

create policy randai_learning_candidates_select on public.randai_learning_candidates for select to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_learning_candidates_insert on public.randai_learning_candidates for insert to authenticated with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_learning_candidates_update on public.randai_learning_candidates for update to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
) with check (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
create policy randai_learning_candidates_delete on public.randai_learning_candidates for delete to authenticated using (
  exists (select 1 from public.hotels h where public.has_hotel_role(h.id, array['RandAI']::text[]))
);
