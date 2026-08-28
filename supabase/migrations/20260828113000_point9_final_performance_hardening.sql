-- Punto 9 final performance hardening.
-- Cover foreign keys used by diagnostics/reminders and Supremo own-issue ownership checks.

create index if not exists promemoria_created_by_idx
  on public.promemoria (created_by);

create index if not exists promemoria_invio_promemoria_id_idx
  on public.promemoria_invio (promemoria_id);

create index if not exists segnalazioni_created_by_user_id_idx
  on public.segnalazioni (created_by_user_id);
