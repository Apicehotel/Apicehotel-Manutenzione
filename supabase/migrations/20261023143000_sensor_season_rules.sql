-- Regole stagionali per i sensori: la configurazione vive nel database,
-- non nella web app legacy HotelGio.
create table if not exists public.sensori_impostazioni (
  id integer primary key check (id = 1),
  stagione text not null default 'inverno' check (stagione in ('estate', 'inverno')),
  soglia_inverno_min numeric not null default 20,
  soglia_estate_max numeric not null default 18,
  soglia_frigo_max numeric not null default 0,
  aggiornato_il timestamptz not null default now()
);

insert into public.sensori_impostazioni (id)
values (1)
on conflict (id) do nothing;

alter table public.sensori_temperatura
  add column if not exists ruolo text not null default 'ambiente',
  add column if not exists soglia numeric,
  add column if not exists allerta_tipo text;

alter table public.sensori_temperatura
  drop constraint if exists sensori_temperatura_ruolo_check;
alter table public.sensori_temperatura
  add constraint sensori_temperatura_ruolo_check
  check (ruolo in ('motore', 'frigo', 'ambiente'));

alter table public.sensori_temperatura
  drop constraint if exists sensori_temperatura_allerta_tipo_check;
alter table public.sensori_temperatura
  add constraint sensori_temperatura_allerta_tipo_check
  check (allerta_tipo is null or allerta_tipo in ('sopra', 'sotto'));

-- Sensori tecnici già censiti per HotelGio. I nuovi sensori restano ambiente
-- finché non vengono classificati esplicitamente.
update public.sensori_temperatura
set ruolo = 'motore'
where device_id in (
  '1001e22b8d', '10025339c4', '1001e22ba7',
  '1002534102', '10025340a7', '10023c8674', '1002534089'
);

alter table public.sensori_impostazioni enable row level security;
revoke all on public.sensori_impostazioni from anon;
grant select, update on public.sensori_impostazioni to authenticated;
grant select, insert, update, delete on public.sensori_impostazioni to service_role;

drop policy if exists sensori_impostazioni_member_select on public.sensori_impostazioni;
create policy sensori_impostazioni_member_select
on public.sensori_impostazioni for select to authenticated
using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid()) and hm.active = true
  )
);

drop policy if exists sensori_impostazioni_admin_update on public.sensori_impostazioni;
create policy sensori_impostazioni_admin_update
on public.sensori_impostazioni for update to authenticated
using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = (select auth.uid())
      and hm.active = true and hm.can_access_admin = true
  )
)
with check (
  stagione in ('estate', 'inverno')
  and soglia_inverno_min between -50 and 60
  and soglia_estate_max between -50 and 60
  and soglia_frigo_max between -50 and 60
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sensori_impostazioni'
  ) then
    alter publication supabase_realtime add table public.sensori_impostazioni;
  end if;
end $$;
