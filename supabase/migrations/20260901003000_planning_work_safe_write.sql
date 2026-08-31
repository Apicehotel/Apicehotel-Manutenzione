-- Blocco 36 — Safe Write Engine
-- Rende atomica e idempotente la creazione Planning Lavori e aggiunge
-- una versione temporale alle righe giornaliere per optimistic concurrency.

alter table public.planning_lavori
  add column if not exists mutation_id text;

create unique index if not exists planning_lavori_mutation_id_uidx
  on public.planning_lavori (mutation_id)
  where mutation_id is not null;

alter table public.planning_lavori_giorni
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.create_planning_work_safe(
  p_hotel_id text,
  p_description text,
  p_dates date[],
  p_created_by_name text,
  p_mutation_id text
)
returns public.planning_lavori
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.planning_lavori%rowtype;
  v_dates date[];
  v_existing_dates date[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sessione autenticata richiesta';
  end if;
  if nullif(btrim(p_hotel_id), '') is null then
    raise exception using errcode = '22023', message = 'hotel_id obbligatorio';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'descrizione obbligatoria';
  end if;
  if nullif(btrim(p_mutation_id), '') is null then
    raise exception using errcode = '22023', message = 'mutation_id obbligatorio';
  end if;

  select array_agg(d order by d)
    into v_dates
  from (select distinct unnest(coalesce(p_dates, '{}'::date[])) as d) normalized;

  if coalesce(cardinality(v_dates), 0) = 0 then
    raise exception using errcode = '22023', message = 'almeno una data è obbligatoria';
  end if;

  select * into v_job
  from public.planning_lavori
  where mutation_id = p_mutation_id;

  if found then
    select array_agg(data order by data)
      into v_existing_dates
    from public.planning_lavori_giorni
    where lavoro_id = v_job.id and hotel_id = v_job.hotel_id;

    if v_job.hotel_id is distinct from p_hotel_id
       or btrim(v_job.descrizione) is distinct from btrim(p_description)
       or coalesce(v_existing_dates, '{}'::date[]) is distinct from v_dates then
      raise exception using errcode = '22023', message = 'mutation_id già usato con payload differente';
    end if;
    return v_job;
  end if;

  insert into public.planning_lavori (
    hotel_id,
    descrizione,
    creato_da,
    created_by_user_id,
    mutation_id
  ) values (
    p_hotel_id,
    btrim(p_description),
    nullif(btrim(coalesce(p_created_by_name, '')), ''),
    auth.uid(),
    p_mutation_id
  )
  on conflict (mutation_id) where mutation_id is not null do nothing
  returning * into v_job;

  if not found then
    select * into v_job
    from public.planning_lavori
    where mutation_id = p_mutation_id;

    select array_agg(data order by data)
      into v_existing_dates
    from public.planning_lavori_giorni
    where lavoro_id = v_job.id and hotel_id = v_job.hotel_id;

    if v_job.hotel_id is distinct from p_hotel_id
       or btrim(v_job.descrizione) is distinct from btrim(p_description)
       or coalesce(v_existing_dates, '{}'::date[]) is distinct from v_dates then
      raise exception using errcode = '22023', message = 'mutation_id già usato con payload differente';
    end if;
    return v_job;
  end if;

  insert into public.planning_lavori_giorni (
    hotel_id,
    lavoro_id,
    data,
    fatto,
    stato
  )
  select p_hotel_id, v_job.id, d, false, 'pending'
  from unnest(v_dates) as d;

  return v_job;
end;
$$;

revoke all on function public.create_planning_work_safe(text, text, date[], text, text) from public;
grant execute on function public.create_planning_work_safe(text, text, date[], text, text) to authenticated;

comment on function public.create_planning_work_safe(text, text, date[], text, text) is
  'Atomic, idempotent Planning Work create. Runs as caller so RLS remains authoritative.';
