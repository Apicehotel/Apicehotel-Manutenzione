create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('push','whatsapp','email')),
  hotel_id text null references public.hotels(id) on delete set null,
  recipient text null,
  subject text null,
  body text not null,
  status text not null default 'disabled' check (status in ('disabled','pending','sent','failed','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  error text null
);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant all on public.notification_outbox to service_role;

create index if not exists notification_outbox_channel_status_idx on public.notification_outbox(channel,status,created_at desc);
create index if not exists notification_outbox_hotel_idx on public.notification_outbox(hotel_id,created_at desc);
