-- Block 31: verified operational learning, hotel-scoped and reversible.

alter table public.randai_learning_candidates add column if not exists hotel_id text;
alter table public.randai_learning_candidates add column if not exists learning_score double precision not null default 0;
alter table public.randai_learning_candidates add column if not exists source_case_ids jsonb not null default '[]'::jsonb;
alter table public.randai_learning_candidates add column if not exists promoted_procedure_id text;

update public.randai_learning_candidates
set hotel_id = coalesce(hotel_id, candidate->>'hotelId')
where hotel_id is null;

alter table public.randai_learning_candidates drop constraint if exists randai_learning_candidates_fingerprint_key;
drop index if exists public.randai_learning_candidates_fingerprint_key;
create unique index if not exists randai_learning_candidates_hotel_fingerprint_key
  on public.randai_learning_candidates(hotel_id, fingerprint)
  where hotel_id is not null;
create index if not exists randai_learning_candidates_hotel_status_idx
  on public.randai_learning_candidates(hotel_id, status, updated_at desc);

-- Replace legacy cross-hotel policies with tenant-scoped policies.
drop policy if exists randai_learning_candidates_select on public.randai_learning_candidates;
drop policy if exists randai_learning_candidates_insert on public.randai_learning_candidates;
drop policy if exists randai_learning_candidates_update on public.randai_learning_candidates;
drop policy if exists randai_learning_candidates_delete on public.randai_learning_candidates;

create policy randai_learning_candidates_select on public.randai_learning_candidates
for select using (hotel_id is not null and (can_manage_randai_hotel(hotel_id) or is_hotel_member(hotel_id)));
create policy randai_learning_candidates_insert on public.randai_learning_candidates
for insert with check (hotel_id is not null and can_manage_randai_hotel(hotel_id));
create policy randai_learning_candidates_update on public.randai_learning_candidates
for update using (hotel_id is not null and can_manage_randai_hotel(hotel_id))
with check (hotel_id is not null and can_manage_randai_hotel(hotel_id));
create policy randai_learning_candidates_delete on public.randai_learning_candidates
for delete using (hotel_id is not null and can_manage_randai_hotel(hotel_id));

alter table public.randai_memory add column if not exists task_id text;
alter table public.randai_memory add column if not exists procedure_id text;
alter table public.randai_memory add column if not exists verification_method text;
alter table public.randai_memory add column if not exists evidence jsonb not null default '{}'::jsonb;
create unique index if not exists randai_memory_verified_issue_unique
  on public.randai_memory(hotel_id, source_issue_id)
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
  v_existing_count integer := 0;
  v_case_id uuid;
  v_location text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  select t.id, t.state, t.completed_at
    into v_task
  from public.randai_tasks t
  where t.hotel_id = new.hotel_id
    and t.source_type = 'issue'
    and t.source_id = new.id::text
  order by t.updated_at desc
  limit 1;

  v_procedure_id := nullif(v_task.state->'metadata'->>'procedureId', '');
  if v_task.state is not null then
    select coalesce(jsonb_agg(s->>'title' order by ord), '[]'::jsonb)
      into v_steps
    from jsonb_array_elements(coalesce(v_task.state->'plan'->'steps', '[]'::jsonb)) with ordinality as x(s, ord)
    where v_task.state->'steps'->(s->>'id')->>'status' = 'SUCCEEDED';
  end if;

  -- A completed issue is evidence, but a missing completion note is not a reusable solution.
  insert into public.randai_knowledge_evidence(
    id, hotel_id, procedure_id, evidence_type, label, metadata, trust, created_at, updated_at
  ) values (
    'EVD-ISSUE-' || gen_random_uuid()::text,
    new.hotel_id,
    v_procedure_id,
    case when nullif(btrim(coalesce(new.completion_note,'')), '') is null then 'incomplete_verified_intervention' else 'verified_intervention' end,
    'Segnalazione conclusa · ' || coalesce(new.location, new.id::text),
    jsonb_build_object(
      'sourceIssueId', new.id,
      'sourceTaskId', v_task.id,
      'category', new.category,
      'location', new.location,
      'description', new.description,
      'completionNote', new.completion_note,
      'completedBy', new.completed_by_name,
      'completedAt', new.completed_at,
      'verifiedSteps', v_steps,
      'verificationMethod', case when v_task.id is null then 'issue_completion' else 'human_checkpoint_plus_issue_completion' end
    ),
    'verified', now(), now()
  );

  if nullif(btrim(coalesce(new.completion_note,'')), '') is null then
    return new;
  end if;

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
  do update set
    solution = excluded.solution,
    last_confirmed_at = excluded.last_confirmed_at,
    confidence = excluded.confidence,
    task_id = excluded.task_id,
    procedure_id = excluded.procedure_id,
    verification_method = excluded.verification_method,
    evidence = excluded.evidence,
    updated_at = now()
  returning id into v_case_id;

  v_fingerprint := md5(lower(concat_ws('|', new.hotel_id, coalesce(new.category,''), coalesce(v_procedure_id,''), regexp_replace(btrim(new.completion_note), '\s+', ' ', 'g'))));
  v_candidate_id := 'LEARN-OPS-' || v_fingerprint;

  select evidence_count into v_existing_count
  from public.randai_learning_candidates
  where hotel_id = new.hotel_id and fingerprint = v_fingerprint;
  v_existing_count := coalesce(v_existing_count, 0);

  v_candidate := jsonb_build_object(
    'hotelId', new.hotel_id,
    'problemClass', lower(coalesce(new.category,'manutenzione')),
    'strategy', btrim(new.completion_note),
    'verified', true,
    'procedureId', v_procedure_id,
    'verifiedSteps', v_steps,
    'source', jsonb_build_object('kind','verified_issue','id',new.id),
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
    source_case_ids = case
      when public.randai_learning_candidates.source_case_ids ? v_case_id::text then public.randai_learning_candidates.source_case_ids
      else public.randai_learning_candidates.source_case_ids || jsonb_build_array(v_case_id::text)
    end,
    candidate = excluded.candidate || jsonb_build_object('evidenceCount', public.randai_learning_candidates.evidence_count + 1),
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.randai_capture_verified_issue_learning() from public;

-- Safe promotion: only a sufficiently evidenced candidate with confirmed steps can become a draft.
create or replace function public.randai_promote_learning_candidate(p_candidate_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.randai_learning_candidates%rowtype;
  v_id text;
  v_steps jsonb;
begin
  select * into c from public.randai_learning_candidates where id = p_candidate_id;
  if not found then raise exception 'learning_candidate_not_found'; end if;
  if not can_manage_randai_hotel(c.hotel_id) then raise exception 'forbidden'; end if;
  if c.evidence_count < 3 or c.status not in ('CANDIDATE','TESTED') then raise exception 'insufficient_verified_evidence'; end if;
  v_steps := coalesce(c.candidate->'verifiedSteps','[]'::jsonb);
  if jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) = 0 then raise exception 'verified_steps_required'; end if;
  if c.promoted_procedure_id is not null then return c.promoted_procedure_id; end if;

  v_id := 'PROC-LEARN-' || substr(c.fingerprint,1,24);
  insert into public.randai_procedures(
    id, hotel_id, title, category, area, symptom, summary, keywords, steps,
    caution, source_label, status, version, approved_at, created_at, updated_at
  ) values (
    v_id, c.hotel_id,
    'Bozza da casi verificati · ' || initcap(c.problem_class),
    c.problem_class,
    null,
    c.candidate->>'problemClass',
    'Bozza generata esclusivamente da almeno tre casi verificati. Richiede revisione umana prima dell’approvazione.',
    array[c.problem_class],
    v_steps,
    'Bozza: controllare ordine, sicurezza e applicabilità dei passaggi prima di approvare.',
    'RandAI · pattern operativo verificato',
    'draft', 1, null, now(), now()
  ) on conflict (id) do nothing;

  update public.randai_learning_candidates
  set promoted_procedure_id = v_id, updated_at = now()
  where id = c.id;
  return v_id;
end;
$$;

grant execute on function public.randai_promote_learning_candidate(text) to authenticated;

drop trigger if exists trg_randai_verified_issue_learning on public.maintenance_issues;
create trigger trg_randai_verified_issue_learning
after update of status on public.maintenance_issues
for each row
when (new.status = 'done' and old.status is distinct from 'done')
execute function public.randai_capture_verified_issue_learning();
