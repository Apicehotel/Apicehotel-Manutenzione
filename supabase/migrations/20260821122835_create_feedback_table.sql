create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  hotel_id text not null references public.hotels(id),
  utente text not null,
  testo text not null,
  creato_il timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Chiunque appartenga all'hotel può lasciare un feedback.
create policy feedback_member_insert on public.feedback
for insert to authenticated
with check (is_hotel_member(hotel_id));

-- Solo chi ha accesso al pannello admin può leggerli (stesso criterio di
-- can_admin_hotel già usato altrove per le funzioni riservate all'admin).
create policy feedback_admin_select on public.feedback
for select to authenticated
using (can_admin_hotel(hotel_id));

create index if not exists feedback_hotel_id_idx on public.feedback(hotel_id, creato_il desc);

alter publication supabase_realtime add table public.feedback;
