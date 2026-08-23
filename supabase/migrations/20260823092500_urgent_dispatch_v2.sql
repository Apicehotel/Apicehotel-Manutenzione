alter table public.richieste_urgenti
  add column if not exists gravita text not null default 'urgente',
  add column if not exists posizione text,
  add column if not exists reparto text,
  add column if not exists foto text,
  add column if not exists presa_in_carico_version bigint not null default 0;

alter table public.richieste_urgenti drop constraint if exists richieste_urgenti_gravita_check;
alter table public.richieste_urgenti add constraint richieste_urgenti_gravita_check check (gravita in ('urgente','emergenza'));

create table if not exists public.richieste_urgenti_eventi (
  id uuid primary key default gen_random_uuid(),
  urgente_id uuid not null references public.richieste_urgenti(id) on delete cascade,
  hotel_id text not null,
  tipo text not null,
  da_chi text,
  dettagli jsonb not null default '{}'::jsonb,
  creato_il timestamptz not null default now()
);
create index if not exists richieste_urgenti_eventi_urgente_idx on public.richieste_urgenti_eventi(urgente_id, creato_il);
create index if not exists richieste_urgenti_eventi_hotel_idx on public.richieste_urgenti_eventi(hotel_id, creato_il desc);
alter table public.richieste_urgenti_eventi enable row level security;
drop policy if exists "urgent_events_read_authenticated" on public.richieste_urgenti_eventi;
create policy "urgent_events_read_authenticated" on public.richieste_urgenti_eventi for select to authenticated using (true);
drop policy if exists "urgent_events_insert_authenticated" on public.richieste_urgenti_eventi;
create policy "urgent_events_insert_authenticated" on public.richieste_urgenti_eventi for insert to authenticated with check (true);

create or replace function public.log_urgent_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli)
    values(new.id,new.hotel_id,'creata',new.creato_da,jsonb_build_object('gravita',new.gravita,'posizione',new.posizione,'reparto',new.reparto));
  elsif tg_op='UPDATE' then
    if old.stato is distinct from new.stato then
      insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli)
      values(new.id,new.hotel_id,case new.stato when 'presa' then 'presa_in_carico' when 'completata' then 'completata' else 'stato_modificato' end,
        case new.stato when 'presa' then new.presa_in_carico_da when 'completata' then new.completata_da else coalesce(new.presa_in_carico_da,new.completata_da) end,
        jsonb_build_object('da',old.stato,'a',new.stato));
    end if;
    if old.trasformata_in_segnalazione_id is distinct from new.trasformata_in_segnalazione_id and new.trasformata_in_segnalazione_id is not null then
      insert into public.richieste_urgenti_eventi(urgente_id,hotel_id,tipo,da_chi,dettagli)
      values(new.id,new.hotel_id,'trasformata',new.completata_da,jsonb_build_object('segnalazione_id',new.trasformata_in_segnalazione_id));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_log_urgent_event on public.richieste_urgenti;
create trigger trg_log_urgent_event after insert or update on public.richieste_urgenti for each row execute function public.log_urgent_event();

create or replace function public.prendi_urgente(p_id uuid,p_hotel_id text,p_nome text) returns public.richieste_urgenti language plpgsql security invoker set search_path=public as $$
declare v_row public.richieste_urgenti;
begin
  update public.richieste_urgenti set stato='presa',presa_in_carico_da=p_nome,presa_in_carico_il=now(),presa_in_carico_version=presa_in_carico_version+1,updated_at=now()
  where id=p_id and hotel_id=p_hotel_id and stato='aperta' returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.richieste_urgenti where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then raise exception 'Avviso urgente non trovato' using errcode='P0002'; end if;
    raise exception 'Avviso già preso in carico da %',coalesce(v_row.presa_in_carico_da,'un altro utente') using errcode='P0001';
  end if;
  return v_row;
end;
$$;

create or replace function public.completa_urgente(p_id uuid,p_hotel_id text,p_nome text) returns public.richieste_urgenti language plpgsql security invoker set search_path=public as $$
declare v_row public.richieste_urgenti;
begin
  update public.richieste_urgenti set stato='completata',completata_da=p_nome,completata_il=now(),updated_at=now()
  where id=p_id and hotel_id=p_hotel_id and stato in ('aperta','presa') returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.richieste_urgenti where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then raise exception 'Avviso urgente non trovato' using errcode='P0002'; end if;
  end if;
  return v_row;
end;
$$;
