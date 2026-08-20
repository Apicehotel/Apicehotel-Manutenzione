create extension if not exists pgcrypto;

create table if not exists public.profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_pin_credentials (
  auth_user_id uuid primary key references public.profiles(auth_user_id) on delete cascade,
  pin_hash text not null,
  must_change_pin boolean not null default false,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.hotel_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references public.profiles(auth_user_id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete cascade,
  role text not null check (role in ('admin','responsabile','manutentore','segnalatore')),
  active boolean not null default true,
  can_access_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (auth_user_id, hotel_id)
);

create table if not exists public.maintenance_issues (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id) on delete restrict,
  location text not null,
  category text,
  priority text not null default 'media' check (priority in ('bassa','media','alta','urgente')),
  status text not null default 'todo' check (status in ('todo','tecnico','waiting','done')),
  description text,
  source text not null default 'app' check (source in ('app','whatsapp','system')),
  department text,
  created_by uuid references public.profiles(auth_user_id) on delete set null,
  assigned_to uuid references public.profiles(auth_user_id) on delete set null,
  external_technician_name text,
  external_technician_phone text,
  waiting_part_name text,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.issue_attachments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.maintenance_issues(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete restrict,
  kind text not null check (kind in ('before','after','other')),
  storage_path text not null,
  uploaded_by uuid references public.profiles(auth_user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.maintenance_issues(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  actor_user_id uuid references public.profiles(auth_user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hotel_memberships_user_idx on public.hotel_memberships(auth_user_id) where active;
create index if not exists hotel_memberships_hotel_idx on public.hotel_memberships(hotel_id) where active;
create index if not exists maintenance_issues_hotel_status_idx on public.maintenance_issues(hotel_id, status, priority, created_at);
create index if not exists issue_events_issue_idx on public.issue_events(issue_id, created_at desc);
create index if not exists issue_attachments_issue_idx on public.issue_attachments(issue_id, created_at);

create or replace function public.is_hotel_member(target_hotel_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = auth.uid()
      and m.hotel_id = target_hotel_id
      and m.active = true
  );
$$;

create or replace function public.has_hotel_role(target_hotel_id text, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = auth.uid()
      and m.hotel_id = target_hotel_id
      and m.active = true
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.can_admin_hotel(target_hotel_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hotel_memberships m
    where m.auth_user_id = auth.uid()
      and m.hotel_id = target_hotel_id
      and m.active = true
      and (m.can_access_admin = true or m.role = 'admin')
  );
$$;

grant execute on function public.is_hotel_member(text) to authenticated;
grant execute on function public.has_hotel_role(text, text[]) to authenticated;
grant execute on function public.can_admin_hotel(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.auth_pin_credentials enable row level security;
alter table public.hotel_memberships enable row level security;
alter table public.maintenance_issues enable row level security;
alter table public.issue_attachments enable row level security;
alter table public.issue_events enable row level security;

revoke all on public.auth_pin_credentials from anon, authenticated;

create policy profiles_self_select on public.profiles
for select to authenticated
using (auth_user_id = auth.uid());

create policy profiles_self_update on public.profiles
for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy memberships_self_select on public.hotel_memberships
for select to authenticated
using (auth_user_id = auth.uid());

create policy memberships_admin_select on public.hotel_memberships
for select to authenticated
using (public.can_admin_hotel(hotel_id));

create policy memberships_admin_insert on public.hotel_memberships
for insert to authenticated
with check (public.can_admin_hotel(hotel_id));

create policy memberships_admin_update on public.hotel_memberships
for update to authenticated
using (public.can_admin_hotel(hotel_id))
with check (public.can_admin_hotel(hotel_id));

create policy memberships_admin_delete on public.hotel_memberships
for delete to authenticated
using (public.can_admin_hotel(hotel_id));

create policy issues_member_select on public.maintenance_issues
for select to authenticated
using (public.is_hotel_member(hotel_id));

create policy issues_member_insert on public.maintenance_issues
for insert to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and created_by = auth.uid()
);

create policy issues_staff_update on public.maintenance_issues
for update to authenticated
using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']))
with check (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy issues_admin_delete on public.maintenance_issues
for delete to authenticated
using (public.can_admin_hotel(hotel_id));

create policy attachments_member_select on public.issue_attachments
for select to authenticated
using (public.is_hotel_member(hotel_id));

create policy attachments_member_insert on public.issue_attachments
for insert to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.maintenance_issues i
    where i.id = issue_id and i.hotel_id = hotel_id
  )
);

create policy attachments_staff_delete on public.issue_attachments
for delete to authenticated
using (public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore']));

create policy events_member_select on public.issue_events
for select to authenticated
using (public.is_hotel_member(hotel_id));

create policy events_staff_insert on public.issue_events
for insert to authenticated
with check (
  public.has_hotel_role(hotel_id, array['admin','responsabile','manutentore'])
  and actor_user_id = auth.uid()
  and exists (
    select 1 from public.maintenance_issues i
    where i.id = issue_id and i.hotel_id = hotel_id
  )
);
