alter table public.prenotazioni_sale add column if not exists data_preparazione date;

alter table public.prenotazioni_sale disable trigger trg_prenotazioni_sale_update_scope;
update public.prenotazioni_sale
set data_preparazione = data
where data_preparazione is null;
alter table public.prenotazioni_sale enable trigger trg_prenotazioni_sale_update_scope;

alter table public.prenotazioni_sale alter column data_preparazione set not null;
alter table public.prenotazioni_sale drop constraint if exists prenotazioni_sale_preparazione_non_successiva;
alter table public.prenotazioni_sale add constraint prenotazioni_sale_preparazione_non_successiva
  check (data_preparazione <= data);

create index if not exists prenotazioni_sale_hotel_preparazione_idx
  on public.prenotazioni_sale(hotel_id, data_preparazione, stato);

create or replace function public.enforce_prenotazioni_sale_update_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.has_hotel_role(old.hotel_id, array['Direttore Centro Congressi']) then
    return new;
  end if;

  if public.has_hotel_role(old.hotel_id, array['manutentore']) then
    if new.hotel_id is distinct from old.hotel_id
       or new.sala is distinct from old.sala
       or new.sala_key is distinct from old.sala_key
       or new.data is distinct from old.data
       or new.data_al is distinct from old.data_al
       or new.data_preparazione is distinct from old.data_preparazione
       or new.turno is distinct from old.turno
       or new.cliente is distinct from old.cliente
       or new.note is distinct from old.note
       or new.allestimento_key is distinct from old.allestimento_key
       or new.allestimento is distinct from old.allestimento
       or new.pax is distinct from old.pax
       or new.creato_da is distinct from old.creato_da
       or new.creato_il is distinct from old.creato_il
       or new.created_by_user_id is distinct from old.created_by_user_id
       or new.mutation_id is distinct from old.mutation_id then
      raise exception 'I manutentori possono modificare solo lo stato operativo della prenotazione';
    end if;
    return new;
  end if;

  raise exception 'Permesso negato per la modifica della prenotazione sala';
end;
$$;

revoke all on function public.enforce_prenotazioni_sale_update_scope() from public, anon, authenticated;
