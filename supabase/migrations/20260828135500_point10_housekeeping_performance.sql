-- Punto 10: copertura FK usata dagli snapshot storici.
create index if not exists housekeeping_daily_rooms_import_id_idx
  on public.housekeeping_daily_rooms (import_id)
  where import_id is not null;
