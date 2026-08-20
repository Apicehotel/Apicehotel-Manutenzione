-- Eriona passa da governante a responsabile_area (zona Isola dei Golosi),
-- stesso meccanismo del ruolo "Colazioni" su Hotel Giò.
update public.utenti
set ruolo = 'responsabile_area'
where nome = 'Eriona';
