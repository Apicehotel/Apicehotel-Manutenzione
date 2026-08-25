-- Le note operative RandApp sono separate dalla vecchia colonna `note`,
-- che poteva contenere testo libero proveniente da Slope.
alter table public.camere_giorno
  add column if not exists operational_note text;

comment on column public.camere_giorno.operational_note is
  'Nota operativa inserita in RandApp. Non deve contenere dati identificativi dell ospite.';
