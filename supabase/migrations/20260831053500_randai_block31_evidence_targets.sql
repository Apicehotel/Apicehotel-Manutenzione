-- Block 31 follow-up: issue/task evidence is a first-class verified knowledge source.

alter table public.randai_knowledge_evidence add column if not exists source_issue_id uuid;
alter table public.randai_knowledge_evidence add column if not exists source_task_id text;
alter table public.randai_knowledge_evidence add column if not exists verification_method text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.randai_knowledge_evidence'::regclass
      and conname='randai_knowledge_evidence_target'
  ) then
    alter table public.randai_knowledge_evidence drop constraint randai_knowledge_evidence_target;
  end if;
end $$;

alter table public.randai_knowledge_evidence
  add constraint randai_knowledge_evidence_target
  check (procedure_id is not null or equipment_id is not null or source_issue_id is not null);

create index if not exists randai_knowledge_evidence_issue_idx
  on public.randai_knowledge_evidence(hotel_id, source_issue_id, created_at desc)
  where source_issue_id is not null;

create or replace function public.randai_capture_verified_issue_learning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_procedure_id text;
  v_steps jsonb := '[]'::jsonb;
  v_fingerprint text;
  v_candidate_id text;
  v_candidate jsonb;
  v_case_id uuid;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;

  select t.id, t.state, t.completed_at into v_task
  from public.randai_tasks t
  where t.hotel_id = new.hotel_id and t.source_type = 'issue' and t.source_id = new.id::text
  order by t.updated_at desc limit 1;

  v_procedure_id := nullif(v_task.state->'metadata'->>'procedureId', '');
  if v_task.state is not null then
    select coalesce(jsonb_agg(s->>'title' order by ord), '[]'::jsonb) into v_steps
    from jsonb_array_elements(coalesce(v_task.state->'plan'->'steps', '[]'::jsonb)) with ordinality as x(s, ord)
    where v_task.state->'steps'->(s->>'id')->>'status' = 'SUCCEEDED';
  end if;

  insert into public.randai_knowledge_evidence(
    id, hotel_id, procedure_id, source_issue_id, source_task_id, verification_method,
    evidence_type, label, metadata, trust, created_at, updated_at
  ) values (
    'EVD-ISSUE-' || gen_random_uuid()::text,
    new.hotel_id, v_procedure_id, new.id, v_task.id,
    case when v_task.id is null then 'issue_completion' else 'human_checkpoint_plus_issue_completion' end,
    case when nullif(btrim(coalesce(new.completion_note,'')), '') is null then 'issue' else 'intervention' end,
    'Segnalazione conclusa · ' || coalesce(new.location, new.id::text),
    jsonb_build_object(
      'category', new.category, 'location', new.location, 'description', new.description,
      'completionNote', new.completion_note, 'completedBy', new.completed_by_name,
      'completedAt', new.completed_at, 'verifiedSteps', v_steps,
      'documentationComplete', nullif(btrim(coalesce(new.completion_note,'')), '') is not null
    ),
    'verified', now(), now()
  );

  -- Evidence without a documented outcome remains evidence only: never searchable as a solution.
  if nullif(btrim(coalesce(new.completion_note,'')), '') is null then return new; end if;

  insert into public.randai_memory(
    hotel_id, source_issue_id, area, category, symptom, cause, solution, outcome,
    confidence, confirmation_count, failure_count, source_label, last_confirmed_at,
    task_id, procedure_id, verification_method, evidence, created_at, updated_at
  ) values (
    new.hotel_id, new.id, new.location, new.category,
    coalesce(nullif(btrim(new.description),''), coalesce(new.category,'Problema manutenzione')),
    null, btrim(new.completion_note), 'resolved',
    case when v_task.id is not null and jsonb_array_length(v_steps) > 0 then 'high' else 'medium' end,
    1, 0, 'Intervento verificato RandApp', coalesce(new.completed_at, now()),
    v_task.id, v_procedure_id,
    case when v_task.id is null then 'issue_completion' else 'human_checkpoint_plus_issue_completion' end,
    jsonb_build_object('verifiedSteps', v_steps, 'completedBy', new.completed_by_name),
    now(), now()
  )
  on conflict (hotel_id, source_issue_id) where source_issue_id is not null
  do update set solution=excluded.solution, last_confirmed_at=excluded.last_confirmed_at,
    confidence=excluded.confidence, task_id=excluded.task_id, procedure_id=excluded.procedure_id,
    verification_method=excluded.verification_method, evidence=excluded.evidence, updated_at=now()
  returning id into v_case_id;

  v_fingerprint := md5(lower(concat_ws('|', new.hotel_id, coalesce(new.category,''), coalesce(v_procedure_id,''), regexp_replace(btrim(new.completion_note), '\s+', ' ', 'g'))));
  v_candidate_id := 'LEARN-OPS-' || v_fingerprint;
  v_candidate := jsonb_build_object(
    'hotelId', new.hotel_id, 'problemClass', lower(coalesce(new.category,'manutenzione')),
    'strategy', btrim(new.completion_note), 'verified', true, 'procedureId', v_procedure_id,
    'verifiedSteps', v_steps, 'source', jsonb_build_object('kind','verified_issue','id',new.id),
    'metadata', jsonb_build_object('memoryCaseId',v_case_id,'taskId',v_task.id,'location',new.location)
  );

  insert into public.randai_learning_candidates(
    id, hotel_id, fingerprint, problem_class, status, evidence_count, candidate,
    learning_score, source_case_ids, created_at, updated_at
  ) values (
    v_candidate_id, new.hotel_id, v_fingerprint, lower(coalesce(new.category,'manutenzione')),
    'OBSERVED', 1, v_candidate, 0.2, jsonb_build_array(v_case_id::text), now(), now()
  )
  on conflict (hotel_id, fingerprint) where hotel_id is not null
  do update set
    evidence_count = public.randai_learning_candidates.evidence_count + 1,
    status = case when public.randai_learning_candidates.evidence_count + 1 >= 3 then 'CANDIDATE' else public.randai_learning_candidates.status end,
    learning_score = least(1.0, (public.randai_learning_candidates.evidence_count + 1)::double precision / 5.0),
    source_case_ids = case when public.randai_learning_candidates.source_case_ids ? v_case_id::text
      then public.randai_learning_candidates.source_case_ids
      else public.randai_learning_candidates.source_case_ids || jsonb_build_array(v_case_id::text) end,
    candidate = excluded.candidate || jsonb_build_object('evidenceCount', public.randai_learning_candidates.evidence_count + 1),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.randai_capture_verified_issue_learning() from public;
