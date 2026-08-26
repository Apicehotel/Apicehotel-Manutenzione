-- Campi per la conferma di arrivo del tecnico via WhatsApp (parita' con HotelGio):
-- tecnico_arrivo_previsto (gia' esistente) resta per l'orario assoluto interpretato;
-- qui aggiungiamo lo stato della risposta e il testo grezzo per contesto.
alter table public.segnalazioni
  add column if not exists tecnico_risposta_stato text check (tecnico_risposta_stato is null or tecnico_risposta_stato in ('in_attesa','confermato','generico','rifiutato'));
alter table public.segnalazioni
  add column if not exists tecnico_arrivo_testo text;

-- Quando una segnalazione entra in stato 'tecnico' con un telefono assegnato,
-- la mettiamo automaticamente 'in_attesa' di risposta (nessuna modifica al frontend).
create or replace function public.set_tecnico_risposta_in_attesa()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.stato = 'tecnico' and new.tecnico_telefono is not null
     and (old.stato is distinct from 'tecnico' or old.tecnico_telefono is distinct from new.tecnico_telefono) then
    new.tecnico_risposta_stato := 'in_attesa';
    new.tecnico_arrivo_testo := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_tecnico_risposta_in_attesa on public.segnalazioni;
create trigger trg_set_tecnico_risposta_in_attesa
before update on public.segnalazioni
for each row execute function public.set_tecnico_risposta_in_attesa();

-- Stato "camera in sospeso" per il flusso conversazionale a due passaggi
-- ("204" -> "Qual e' il problema?"), sostituisce whatsapp_inbox (solo HotelGio)
-- con una versione multi-hotel: una riga per hotel+telefono, l'ultima vince.
create table if not exists public.whatsapp_pending_camera (
  hotel_id text not null,
  phone_key text not null,
  camera text not null,
  created_at timestamptz not null default now(),
  primary key (hotel_id, phone_key)
);
alter table public.whatsapp_pending_camera enable row level security;
-- Nessuna policy pubblica: solo le edge function con service_role vi accedono.
