create table if not exists public.rand_research_sessions (
  session_id text primary key,
  canonical_query text not null check (length(btrim(canonical_query))>0),
  hotel_id text not null,
  level text not null check (level in ('L0','L1','L2','L3','L4')),
  requirements jsonb not null default '[]'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  subqueries jsonb not null default '[]'::jsonb,
  status text not null check (status in ('PLANNED','RUNNING','NEEDS_REVIEW','READY','BLOCKED')),
  contradictions jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  report jsonb,
  ship_gate jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rand_research_sources (
  session_id text not null references public.rand_research_sessions(session_id) on delete cascade,
  source_id text not null,
  hotel_id text not null,
  source_kind text not null,
  source_uri text not null,
  title text not null,
  excerpt text not null,
  tier text not null check (tier in ('PRIMARY','AUTHORITATIVE','SECONDARY','COMMUNITY','UNKNOWN')),
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  claims jsonb not null default '[]'::jsonb,
  coverage jsonb not null default '[]'::jsonb,
  directness double precision not null check (directness between 0 and 1),
  recency double precision not null check (recency between 0 and 1),
  corroboration double precision not null check (corroboration between 0 and 1),
  retrieval_confidence double precision not null check (retrieval_confidence between 0 and 1),
  quality_score integer not null check (quality_score between 0 and 100),
  prompt_injection_risk boolean not null default false,
  retraction_risk boolean not null default false,
  primary key(session_id,source_id)
);

create index if not exists rand_research_sessions_hotel_idx on public.rand_research_sessions(hotel_id,updated_at desc);
create index if not exists rand_research_sources_quality_idx on public.rand_research_sources(session_id,quality_score desc);

alter table public.rand_research_sessions enable row level security;
alter table public.rand_research_sources enable row level security;
revoke all on table public.rand_research_sessions from public,anon,authenticated;
revoke all on table public.rand_research_sources from public,anon,authenticated;
grant select,insert,update on table public.rand_research_sessions to service_role;
grant select,insert,update,delete on table public.rand_research_sources to service_role;

create or replace function public.rand_research_guard_source_scope()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_hotel text;
begin
 select hotel_id into v_hotel from public.rand_research_sessions where session_id=new.session_id;
 if v_hotel is null then raise exception 'randresearch_session_not_found'; end if;
 if new.hotel_id<>v_hotel then raise exception 'randresearch_cross_hotel_source_denied'; end if;
 return new;
end;
$$;

drop trigger if exists rand_research_source_scope on public.rand_research_sources;
create trigger rand_research_source_scope before insert or update on public.rand_research_sources for each row execute function public.rand_research_guard_source_scope();
revoke all on function public.rand_research_guard_source_scope() from public,anon,authenticated;
