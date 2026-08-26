alter table public.hotel_memberships drop constraint hotel_memberships_role_check;
alter table public.hotel_memberships add constraint hotel_memberships_role_check
  check (role = any (array['admin','Responsabile','Direzione','Direttore Centro Congressi','Portiere Notturno','manutentore','Tecnico esterno','segnalatore','Governante','Reception','Isola dei Golosi','Ristorante Wine','Ristorante Jazz','Colazione Jazz']));
