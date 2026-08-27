create table if not exists public.sale_rooms_config (
  hotel_id text not null,
  room_key text not null,
  name text not null,
  family text not null,
  parts text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hotel_id, room_key),
  unique (hotel_id, name)
);

create index if not exists sale_rooms_config_hotel_active_sort_idx on public.sale_rooms_config (hotel_id, active, sort_order, name);
alter table public.sale_rooms_config enable row level security;

drop policy if exists sale_rooms_config_read on public.sale_rooms_config;
create policy sale_rooms_config_read on public.sale_rooms_config for select to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi','manutentore']));
drop policy if exists sale_rooms_config_insert on public.sale_rooms_config;
create policy sale_rooms_config_insert on public.sale_rooms_config for insert to authenticated with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));
drop policy if exists sale_rooms_config_update on public.sale_rooms_config;
create policy sale_rooms_config_update on public.sale_rooms_config for update to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi'])) with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));
drop policy if exists sale_rooms_config_delete on public.sale_rooms_config;
create policy sale_rooms_config_delete on public.sale_rooms_config for delete to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));

create or replace function public.touch_sale_rooms_config_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.touch_sale_rooms_config_updated_at() from public, anon, authenticated;
drop trigger if exists trg_sale_rooms_config_updated_at on public.sale_rooms_config;
create trigger trg_sale_rooms_config_updated_at before update on public.sale_rooms_config for each row execute function public.touch_sale_rooms_config_updated_at();

alter table public.prenotazioni_sale add column if not exists sala_key text;
create index if not exists prenotazioni_sale_hotel_sala_key_idx on public.prenotazioni_sale (hotel_id, sala_key, data, data_al, turno);

insert into public.sale_rooms_config (hotel_id, room_key, name, family, parts, sort_order)
values
('hotelgio','guitar','Guitar','Guitar',array['guitar'],10),('hotelgio','drums','Drums','Drums',array['drums'],20),('hotelgio','room','Room','Room',array['room'],30),('hotelgio','preservation','Preservation','Preservation',array['preservation'],40),('hotelgio','cool','Cool','Cool',array['cool'],50),
('hotelgio','trumpet-1','Trumpet 1','Trumpet',array['t1'],60),('hotelgio','trumpet-2','Trumpet 2','Trumpet',array['t2'],70),('hotelgio','trumpet-3','Trumpet 3','Trumpet',array['t3'],80),('hotelgio','trumpet-4','Trumpet 4','Trumpet',array['t4'],90),('hotelgio','trumpet-1-2','Trumpet 1+2','Trumpet',array['t1','t2'],100),('hotelgio','trumpet-2-3','Trumpet 2+3','Trumpet',array['t2','t3'],110),('hotelgio','trumpet-3-4','Trumpet 3+4','Trumpet',array['t3','t4'],120),('hotelgio','trumpet-1-2-3','Trumpet 1+2+3','Trumpet',array['t1','t2','t3'],130),('hotelgio','trumpet-2-3-4','Trumpet 2+3+4','Trumpet',array['t2','t3','t4'],140),('hotelgio','trumpet-1-2-3-4','Trumpet 1+2+3+4','Trumpet',array['t1','t2','t3','t4'],150),
('hotelgio','sax-1','Sax 1','Sax',array['s1'],160),('hotelgio','sax-2','Sax 2','Sax',array['s2'],170),('hotelgio','sax-3','Sax 3','Sax',array['s3'],180),('hotelgio','sax-1-2','Sax 1+2','Sax',array['s1','s2'],190),('hotelgio','sax-2-3','Sax 2+3','Sax',array['s2','s3'],200),('hotelgio','sax-1-2-3','Sax 1+2+3','Sax',array['s1','s2','s3'],210),
('hotelgio','auditorium-intero','Auditorium Intero','Auditorium',array['auditorium-tower-1','auditorium-tower-2'],220),('hotelgio','auditorium-tower-1','Auditorium Tower 1','Auditorium',array['auditorium-tower-1'],230),('hotelgio','auditorium-tower-2','Auditorium Tower 2','Auditorium',array['auditorium-tower-2'],240),('hotelgio','cantina','Cantina','Cantina',array['cantina'],250),('hotelgio','gusto','Gusto','Gusto',array['gusto'],260),('hotelgio','cravatte','Cravatte','Cravatte',array['cravatte'],270),('hotelgio','sala-delle-feste','Sala delle Feste','Sala delle Feste',array['feste'],280)
on conflict (hotel_id, room_key) do update set name=excluded.name,family=excluded.family,parts=excluded.parts,sort_order=excluded.sort_order;

update public.prenotazioni_sale p set sala_key=c.room_key from public.sale_rooms_config c where p.hotel_id=c.hotel_id and p.sala_key is null and p.sala=c.name;

drop policy if exists prenotazioni_sale_member_select on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_staff_insert on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_staff_update on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_staff_delete on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_ops_select on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_congress_insert on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_ops_update on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_congress_delete on public.prenotazioni_sale;
create policy prenotazioni_sale_ops_select on public.prenotazioni_sale for select to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi','manutentore']));
create policy prenotazioni_sale_congress_insert on public.prenotazioni_sale for insert to authenticated with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));
create policy prenotazioni_sale_ops_update on public.prenotazioni_sale for update to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi','manutentore'])) with check (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi','manutentore']));
create policy prenotazioni_sale_congress_delete on public.prenotazioni_sale for delete to authenticated using (public.has_hotel_role(hotel_id, array['Direttore Centro Congressi']));

create or replace function public.enforce_prenotazioni_sale_update_scope() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.has_hotel_role(old.hotel_id, array['Direttore Centro Congressi']) then return new; end if;
  if public.has_hotel_role(old.hotel_id, array['manutentore']) then
    if new.hotel_id is distinct from old.hotel_id or new.sala is distinct from old.sala or new.sala_key is distinct from old.sala_key or new.data is distinct from old.data or new.data_al is distinct from old.data_al or new.turno is distinct from old.turno or new.cliente is distinct from old.cliente or new.note is distinct from old.note or new.creato_da is distinct from old.creato_da or new.creato_il is distinct from old.creato_il or new.created_by_user_id is distinct from old.created_by_user_id or new.mutation_id is distinct from old.mutation_id then
      raise exception 'I manutentori possono modificare solo lo stato operativo della prenotazione';
    end if;
    return new;
  end if;
  raise exception 'Permesso negato per la modifica della prenotazione sala';
end; $$;
revoke all on function public.enforce_prenotazioni_sale_update_scope() from public, anon, authenticated;
drop trigger if exists trg_prenotazioni_sale_update_scope on public.prenotazioni_sale;
create trigger trg_prenotazioni_sale_update_scope before update on public.prenotazioni_sale for each row execute function public.enforce_prenotazioni_sale_update_scope();
