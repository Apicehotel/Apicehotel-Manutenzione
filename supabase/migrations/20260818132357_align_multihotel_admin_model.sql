alter table public.utenti add column if not exists is_system_protected boolean not null default false;
alter table public.profiles add column if not exists is_system_protected boolean not null default false;

update public.utenti
set ruolo = 'admin',
    hotels = array['hotelgio','chocohotel','brigantino']::text[],
    puo_admin = true,
    active = true,
    department = 'Sviluppo',
    deve_cambiare_pin = false,
    is_system_protected = true
where nome = 'Randagio';

update public.utenti set is_system_protected = false where nome <> 'Randagio';

alter table public.hotel_memberships drop constraint if exists hotel_memberships_role_check;
alter table public.hotel_memberships add constraint hotel_memberships_role_check
check (role = any (array['admin','Responsabile','Direzione','Direttore Centro Congressi','Portiere Notturno','manutentore','Tecnico esterno','segnalatore']::text[]));

-- ATTENZIONE: valore originale REDATTO da Claude (2026-08-20). La migrazione
-- reale inseriva qui l'hash SHA256 del PIN admin a 6 cifre. Un hash SHA256 di
-- un PIN a 6 cifre è banalmente forzabile via brute-force (un milione di
-- combinazioni) se esposto in un repo git pubblico: non va mai committato.
-- Il valore reale resta solo in public.edge_function_secrets sul database live.
insert into public.edge_function_secrets(key,value,updated_at)
values ('ADMIN_PANEL_PIN_SHA256','<REDACTED_ADMIN_PIN_SHA256_HASH>',now())
on conflict (key) do update set value=excluded.value, updated_at=now();
