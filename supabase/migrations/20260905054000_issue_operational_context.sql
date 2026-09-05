-- Contesto operativo strutturato per le segnalazioni RandApp.
-- Le colonne restano nullable per compatibilita con storico, zone e client precedenti.

alter table public.segnalazioni
  add column if not exists location_mode text,
  add column if not exists room_number text,
  add column if not exists area_code text,
  add column if not exists area_label text,
  add column if not exists floor_number integer,
  add column if not exists floor_label text,
  add column if not exists source_module text,
  add column if not exists source_ref text;

alter table public.segnalazioni
  drop constraint if exists segnalazioni_location_mode_check,
  drop constraint if exists segnalazioni_room_number_check,
  drop constraint if exists segnalazioni_area_code_check,
  drop constraint if exists segnalazioni_area_label_check,
  drop constraint if exists segnalazioni_floor_number_check,
  drop constraint if exists segnalazioni_floor_label_check,
  drop constraint if exists segnalazioni_source_module_check,
  drop constraint if exists segnalazioni_source_ref_check;

alter table public.segnalazioni
  add constraint segnalazioni_location_mode_check
    check (location_mode is null or location_mode in ('camera','zona')),
  add constraint segnalazioni_room_number_check
    check (room_number is null or length(btrim(room_number)) between 1 and 20),
  add constraint segnalazioni_area_code_check
    check (area_code is null or length(btrim(area_code)) between 1 and 32),
  add constraint segnalazioni_area_label_check
    check (area_label is null or length(btrim(area_label)) between 1 and 80),
  add constraint segnalazioni_floor_number_check
    check (floor_number is null or floor_number between -5 and 100),
  add constraint segnalazioni_floor_label_check
    check (floor_label is null or length(btrim(floor_label)) between 1 and 40),
  add constraint segnalazioni_source_module_check
    check (source_module is null or length(btrim(source_module)) between 1 and 40),
  add constraint segnalazioni_source_ref_check
    check (source_ref is null or length(btrim(source_ref)) between 1 and 180);

-- Recupera senza rischi la semantica camera/zona gia presente nelle etichette storiche.
update public.segnalazioni
set location_mode = case
  when camera ~* '^Camera[[:space:]]*·' then 'camera'
  when camera ~* '^Zona[[:space:]]*·' then 'zona'
  else location_mode
end
where location_mode is null;

update public.segnalazioni
set room_number = btrim(regexp_replace(camera, '^Camera[[:space:]]*·[[:space:]]*', '', 'i'))
where room_number is null
  and camera ~* '^Camera[[:space:]]*·[[:space:]]*[0-9]{1,20}[[:space:]]*$';

create index if not exists segnalazioni_hotel_floor_open_idx
  on public.segnalazioni(hotel_id, area_code, floor_number, creato_il desc)
  where deleted_at is null and stato <> 'done';

comment on column public.segnalazioni.location_mode is 'Tipo posizione strutturata: camera o zona.';
comment on column public.segnalazioni.room_number is 'Numero camera puro, separato dall etichetta legacy camera.';
comment on column public.segnalazioni.area_code is 'Codice area/ala operativo, per esempio jazz o wine.';
comment on column public.segnalazioni.area_label is 'Etichetta area/ala mostrata in UI.';
comment on column public.segnalazioni.floor_number is 'Piano operativo strutturato quando applicabile.';
comment on column public.segnalazioni.floor_label is 'Etichetta del piano mostrata in UI.';
comment on column public.segnalazioni.source_module is 'Modulo RandApp che ha originato la segnalazione, per esempio housekeeping.';
comment on column public.segnalazioni.source_ref is 'Riferimento snapshot alla sorgente; non e una FK per non legare lo storico a dati giornalieri.';
