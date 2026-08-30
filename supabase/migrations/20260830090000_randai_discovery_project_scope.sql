alter table public.randai_discovery_candidates
  drop constraint if exists randai_discovery_candidates_pkey;

alter table public.randai_discovery_candidates
  add constraint randai_discovery_candidates_pkey primary key (project_id, id);
