create table if not exists public.sale_clients (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null,
  name text not null,
  preferred_room_key text,
  preferred_layout_key text,
  preferred_pax integer,
  recurring_notes text not null default '',
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, name),
  constraint sale_clients_pax_positive check (preferred_pax is null or preferred_pax > 0)
);
create index if not exists sale_clients_hotel_active_name_idx on public.sale_clients(hotel_id, active, name);
alter table public.sale_clients enable row level security;
drop policy if exists sale_clients_congress_select on public.sale_clients;
drop policy if exists sale_clients_congress_write on public.sale_clients;
create policy sale_clients_congress_select on public.sale_clients for select to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));
create policy sale_clients_congress_write on public.sale_clients for all to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi'])) with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));

create table if not exists public.sale_layouts_config (
  hotel_id text not null,
  layout_key text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(hotel_id, layout_key),
  unique(hotel_id, name)
);
create index if not exists sale_layouts_hotel_active_sort_idx on public.sale_layouts_config(hotel_id, active, sort_order, name);
alter table public.sale_layouts_config enable row level security;
drop policy if exists sale_layouts_congress_select on public.sale_layouts_config;
drop policy if exists sale_layouts_congress_write on public.sale_layouts_config;
create policy sale_layouts_congress_select on public.sale_layouts_config for select to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));
create policy sale_layouts_congress_write on public.sale_layouts_config for all to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi'])) with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));

insert into public.sale_layouts_config(hotel_id,layout_key,name,sort_order)
select h.hotel_id,v.layout_key,v.name,v.sort_order
from (select distinct hotel_id from public.hotel_memberships where active=true) h
cross join (values ('platea','Platea',10),('banchi-scuola','Banchi scuola',20),('ferro-di-cavallo','Ferro di cavallo',30),('cabaret','Cabaret',40)) v(layout_key,name,sort_order)
on conflict(hotel_id,layout_key) do update set name=excluded.name,sort_order=excluded.sort_order;

alter table public.prenotazioni_sale add column if not exists allestimento_key text;
alter table public.prenotazioni_sale add column if not exists allestimento text;
alter table public.prenotazioni_sale add column if not exists pax integer;
alter table public.prenotazioni_sale drop constraint if exists prenotazioni_sale_pax_positive;
alter table public.prenotazioni_sale add constraint prenotazioni_sale_pax_positive check (pax is null or pax > 0);

create or replace function public.touch_sale_directory_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.touch_sale_directory_updated_at() from public,anon,authenticated;
drop trigger if exists trg_sale_clients_updated_at on public.sale_clients;
create trigger trg_sale_clients_updated_at before update on public.sale_clients for each row execute function public.touch_sale_directory_updated_at();
drop trigger if exists trg_sale_layouts_updated_at on public.sale_layouts_config;
create trigger trg_sale_layouts_updated_at before update on public.sale_layouts_config for each row execute function public.touch_sale_directory_updated_at();

create or replace function public.enforce_prenotazioni_sale_update_scope() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.has_hotel_role(old.hotel_id, array['Direttore Centro Congressi']) then return new; end if;
  if public.has_hotel_role(old.hotel_id, array['manutentore']) then
    if new.hotel_id is distinct from old.hotel_id or new.sala is distinct from old.sala or new.sala_key is distinct from old.sala_key or new.data is distinct from old.data or new.data_al is distinct from old.data_al or new.turno is distinct from old.turno or new.cliente is distinct from old.cliente or new.note is distinct from old.note or new.allestimento_key is distinct from old.allestimento_key or new.allestimento is distinct from old.allestimento or new.pax is distinct from old.pax or new.creato_da is distinct from old.creato_da or new.creato_il is distinct from old.creato_il or new.created_by_user_id is distinct from old.created_by_user_id or new.mutation_id is distinct from old.mutation_id then
      raise exception 'I manutentori possono modificare solo lo stato operativo della prenotazione';
    end if;
    return new;
  end if;
  raise exception 'Permesso negato per la modifica della prenotazione sala';
end; $$;
revoke all on function public.enforce_prenotazioni_sale_update_scope() from public,anon,authenticated;
