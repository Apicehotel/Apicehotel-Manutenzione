create table if not exists public.randai_guidance_sessions (
  id text primary key,
  hotel_id text not null references public.hotels(id) on delete cascade,
  procedure_id text not null,
  procedure_version integer not null default 1,
  actor_role text not null,
  status text not null check (status in ('ACTIVE','BLOCKED','ESCALATED','COMPLETED','CANCELLED')),
  current_step_id text,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists randai_guidance_sessions_hotel_status_idx on public.randai_guidance_sessions(hotel_id, status, updated_at desc);
create index if not exists randai_guidance_sessions_procedure_idx on public.randai_guidance_sessions(procedure_id, updated_at desc);

alter table public.randai_guidance_sessions enable row level security;

create policy "randai_guidance_member_select" on public.randai_guidance_sessions for select using (public.is_hotel_member(hotel_id));
create policy "randai_guidance_admin_insert" on public.randai_guidance_sessions for insert with check (public.can_manage_randai_hotel(hotel_id));
create policy "randai_guidance_admin_update" on public.randai_guidance_sessions for update using (public.can_manage_randai_hotel(hotel_id)) with check (public.can_manage_randai_hotel(hotel_id));
create policy "randai_guidance_admin_delete" on public.randai_guidance_sessions for delete using (public.can_manage_randai_hotel(hotel_id));
