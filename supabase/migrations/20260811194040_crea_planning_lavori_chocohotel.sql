create table if not exists planning_lavori (
  id uuid primary key default gen_random_uuid(),
  descrizione text not null,
  creato_da text,
  creato_il timestamptz not null default now()
);

create table if not exists planning_lavori_giorni (
  id uuid primary key default gen_random_uuid(),
  lavoro_id uuid not null references planning_lavori(id) on delete cascade,
  data date not null,
  fatto boolean not null default false,
  fatto_da text,
  fatto_il timestamptz,
  note text,
  stato text not null default 'aperto' check (stato in ('aperto', 'da_finire', 'fatto')),
  unique(lavoro_id, data)
);

create index if not exists idx_planning_lavori_giorni_data on planning_lavori_giorni(data);
create index if not exists idx_planning_lavori_giorni_lavoro on planning_lavori_giorni(lavoro_id);

alter table planning_lavori enable row level security;
alter table planning_lavori_giorni enable row level security;

create policy "planning_lavori_all" on planning_lavori for all using (true) with check (true);
create policy "planning_lavori_giorni_all" on planning_lavori_giorni for all using (true) with check (true);

alter publication supabase_realtime add table planning_lavori;
alter publication supabase_realtime add table planning_lavori_giorni;
