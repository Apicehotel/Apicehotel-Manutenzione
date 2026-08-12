-- Initial multi-hotel model.
-- Intentionally does not create production policies yet.
-- RLS will be designed around authenticated users and hotel membership.

create table if not exists public.hotels (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.hotels (id, name)
values
  ('hotelgio', 'HotelGio'),
  ('chocohotel', 'ChocoHotel'),
  ('brigantino', 'Hotel Il Brigantino')
on conflict (id) do nothing;

create table if not exists public.user_hotel_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  role text not null check (role in ('admin', 'responsabile', 'tecnico', 'housekeeping')),
  created_at timestamptz not null default now(),
  primary key (user_id, hotel_id)
);

create table if not exists public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id),
  camera text,
  categoria text,
  urgenza text,
  stato text not null default 'todo',
  tecnico_id uuid,
  note text,
  creato_da uuid references auth.users(id),
  creato_il timestamptz not null default now(),
  completato_il timestamptz
);

create index if not exists idx_segnalazioni_hotel_stato
  on public.segnalazioni(hotel_id, stato);

alter table public.hotels enable row level security;
alter table public.user_hotel_memberships enable row level security;
alter table public.segnalazioni enable row level security;

-- Policies will be added only after the membership/auth model is finalized.
