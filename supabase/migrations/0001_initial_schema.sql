-- Base multi-hotel isolata. Da applicare solo a un nuovo progetto Supabase.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'responsabile', 'manutentore', 'segnalatore');
create type public.issue_status as enum ('todo', 'tecnico', 'attesa_pezzo', 'completata');
create type public.issue_urgency as enum ('bassa', 'media', 'alta', 'urgente');

create table public.hotels (
  id text primary key,
  name text not null,
  logo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.hotels (id, name) values
  ('hotelgio', 'Hotel Giò'),
  ('chocohotel', 'ChocoHotel'),
  ('brigantino', 'Hotel Il Brigantino');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department text check (department is null or department in ('Governante','Reception','Isola dei Golosi','Ristorante Wine','Ristorante Jazz','Colazione Jazz')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_hotel_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, hotel_id)
);

create table public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete restrict,
  camera_zona text not null,
  reparto text,
  categoria text,
  origine text not null default 'app',
  urgenza public.issue_urgency not null default 'media',
  stato public.issue_status not null default 'todo',
  descrizione text not null,
  foto_path text,
  creato_da uuid not null references public.profiles(id),
  assegnato_a uuid references public.profiles(id),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  completato_il timestamptz
);

create index memberships_hotel_user_idx on public.user_hotel_memberships (hotel_id, user_id) where active;
create index memberships_user_hotel_idx on public.user_hotel_memberships (user_id, hotel_id) where active;
create index segnalazioni_hotel_status_urgency_created_idx on public.segnalazioni (hotel_id, stato, urgenza desc, creato_il asc);
create index segnalazioni_hotel_completed_idx on public.segnalazioni (hotel_id, completato_il desc) where stato = 'completata';
create index segnalazioni_creator_idx on public.segnalazioni (creato_da);
create index segnalazioni_assignee_idx on public.segnalazioni (assegnato_a) where assegnato_a is not null;

create or replace function public.is_hotel_member(target_hotel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_hotel_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and membership.hotel_id = target_hotel
      and membership.active
      and profile.revoked_at is null
  );
$$;

create or replace function public.has_hotel_role(target_hotel text, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_hotel_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.hotel_id = target_hotel
      and membership.active
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_hotel_member(text) from public;
revoke all on function public.has_hotel_role(text, public.app_role[]) from public;
grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_hotel_role(text, public.app_role[]) to authenticated;

alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.user_hotel_memberships enable row level security;
alter table public.segnalazioni enable row level security;

create policy hotels_member_read on public.hotels for select to authenticated
  using ((select public.is_hotel_member(id)));
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy memberships_self_read on public.user_hotel_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy issues_member_read on public.segnalazioni for select to authenticated
  using ((select public.is_hotel_member(hotel_id)));
create policy issues_member_create on public.segnalazioni for insert to authenticated
  with check ((select public.is_hotel_member(hotel_id)) and creato_da = (select auth.uid()));
create policy issues_operator_update on public.segnalazioni for update to authenticated
  using ((select public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']::public.app_role[])))
  with check ((select public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']::public.app_role[])));
create policy issues_manager_delete on public.segnalazioni for delete to authenticated
  using ((select public.has_hotel_role(hotel_id, array['admin','responsabile']::public.app_role[])));

-- Storage: creare un bucket privato `maintenance-photos`.
-- Path obbligatorio: <hotel_id>/<segnalazione_id>/<filename>.
create policy photos_member_read on storage.objects for select to authenticated
  using (bucket_id = 'maintenance-photos' and (select public.is_hotel_member((storage.foldername(name))[1])));
create policy photos_member_create on storage.objects for insert to authenticated
  with check (bucket_id = 'maintenance-photos' and (select public.is_hotel_member((storage.foldername(name))[1])));
