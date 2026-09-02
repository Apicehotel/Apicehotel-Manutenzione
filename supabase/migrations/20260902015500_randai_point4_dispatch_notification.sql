alter table public.technician_dispatch_requests
  add column if not exists notification_sid text,
  add column if not exists notification_status text,
  add column if not exists notification_error text,
  add column if not exists notification_sent_at timestamptz;

create index if not exists technician_dispatch_notification_status_idx
  on public.technician_dispatch_requests(hotel_id, notification_status, created_at desc);
