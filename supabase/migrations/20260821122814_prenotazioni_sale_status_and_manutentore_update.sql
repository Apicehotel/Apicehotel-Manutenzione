alter table public.prenotazioni_sale
  add column if not exists stato text not null default 'pending',
  add column if not exists da_finire_da text,
  add column if not exists da_finire_il timestamptz,
  add column if not exists completata_da text,
  add column if not exists completata_il timestamptz;

-- La policy di update originale copriva solo chi può creare/modificare/eliminare
-- (admin/Responsabile/Direzione/Direttore Centro Congressi). I manutentori fanno
-- fisicamente l'allestimento delle sale e devono poter segnare Da finire/Fatto
-- anche senza poter creare o eliminare prenotazioni (stesso canMarkStatus già
-- usato lato client per Planning Sale).
drop policy if exists prenotazioni_sale_staff_update on public.prenotazioni_sale;
create policy prenotazioni_sale_staff_update on public.prenotazioni_sale
for update to authenticated
using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]))
with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));

alter publication supabase_realtime add table public.prenotazioni_sale;
