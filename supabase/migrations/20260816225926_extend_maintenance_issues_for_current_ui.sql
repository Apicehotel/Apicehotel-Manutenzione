alter table public.maintenance_issues
  add column if not exists room_status text,
  add column if not exists created_by_name text,
  add column if not exists completed_by_name text,
  add column if not exists piece_decision text,
  add column if not exists piece_decision_by text,
  add column if not exists piece_replaced text,
  add column if not exists piece_replaced_by text,
  add column if not exists technician_requested_by text,
  add column if not exists technician_requested_at timestamptz;

create index if not exists maintenance_issues_hotel_created_idx
  on public.maintenance_issues(hotel_id, created_at desc);
