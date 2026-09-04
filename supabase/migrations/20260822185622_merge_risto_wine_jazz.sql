-- Ristorante Wine e Ristorante Jazz sono un unico reparto operativo.
update public.hotel_memberships set role = 'Ristorante Wine/Jazz' where role in ('Ristorante Wine','Ristorante Jazz');
update public.utenti set ruolo = 'Ristorante Wine/Jazz' where ruolo in ('Ristorante Wine','Ristorante Jazz');

alter table public.hotel_memberships drop constraint hotel_memberships_role_check;
alter table public.hotel_memberships add constraint hotel_memberships_role_check
  check (role = any (array['admin','Responsabile','Direzione','Direttore Centro Congressi','Portiere Notturno','manutentore','Tecnico esterno','Governante','Reception','Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz']));
