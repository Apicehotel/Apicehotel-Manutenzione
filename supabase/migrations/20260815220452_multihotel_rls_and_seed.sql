do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
    and tablename in ('hotels','utenti','tecnici','segnalazioni','interventi',
      'richieste_urgenti','sensori_temperatura','camere_giorno','camere_lavoro',
      'import_camere','planning_lavori','planning_lavori_giorni','prenotazioni_sale',
      'app_config','push_subscriptions')
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t||'_all', t);
  end loop;
end $$;

insert into hotels (id, nome, tinta) values
  ('hotelgio',   'Hotel Giò',            '#0e5c49'),
  ('chocohotel', 'ChocoHotel',           '#640A0A'),
  ('brigantino', 'Hotel Il Brigantino',  '#0B5FA5')
on conflict (id) do nothing;
