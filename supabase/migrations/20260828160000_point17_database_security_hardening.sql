-- Punto 17: hardening database e sicurezza.
-- Il browser anonimo entra solo da Edge Function esplicite: niente accesso diretto alle tabelle public.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Tabelle di servizio: deny-by-grant esplicito per i ruoli browser.
revoke all privileges on table public.auth_pin_credentials from anon, authenticated;
revoke all privileges on table public.edge_function_secrets from anon, authenticated;
revoke all privileges on table public.integration_settings from anon, authenticated;
revoke all privileges on table public.notification_outbox from anon, authenticated;
revoke all privileges on table public.pin_recovery_requests from anon, authenticated;
revoke all privileges on table public.technician_access_tokens from anon, authenticated;
revoke all privileges on table public.urgent_reminder_jobs from anon, authenticated;
revoke all privileges on table public.weather_alert_state from anon, authenticated;
revoke all privileges on table public.whatsapp_pending_camera from anon, authenticated;
revoke all privileges on table public.whatsapp_template_status from anon, authenticated;

-- Il Punto 11 garantisce già issue_id + hotel_id tramite FK composita.
-- Eliminiamo quindi l'helper SECURITY DEFINER ridondante dall'API esposta.
drop policy if exists attachments_member_insert on public.issue_attachments;
create policy attachments_member_insert on public.issue_attachments
for insert to authenticated
with check (
  public.is_hotel_member(hotel_id)
  and uploaded_by = (select auth.uid())
);

drop policy if exists events_staff_insert on public.issue_events;
create policy events_staff_insert on public.issue_events
for insert to authenticated
with check (
  public.has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno'])
  and actor_user_id = (select auth.uid())
);

revoke execute on function public.issue_attachment_same_hotel(uuid,text) from authenticated, anon, public;
drop function if exists public.issue_attachment_same_hotel(uuid,text);

-- Urgenze: autorizzazione dalla matrice centrale, non da whitelist di ruoli duplicata.
create or replace function public.prendi_urgente(p_id uuid, p_hotel_id text, p_nome text)
returns public.richieste_urgenti
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.richieste_urgenti;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode='28000';
  end if;
  if p_hotel_id is null or btrim(p_hotel_id) = '' then
    raise exception 'hotel_id mancante' using errcode='22023';
  end if;
  if not public.has_app_permission(p_hotel_id, 'urgent', 'take_charge') then
    raise exception 'Non autorizzato a prendere in carico questo avviso' using errcode='42501';
  end if;

  select coalesce(nullif(trim(p.display_name),''), nullif(trim(p_nome),''), 'Utente')
    into v_name
  from public.hotel_memberships hm
  left join public.profiles p on p.auth_user_id = hm.auth_user_id
  where hm.auth_user_id = v_uid
    and hm.hotel_id = p_hotel_id
    and hm.active = true
  limit 1;

  update public.richieste_urgenti
     set stato='presa',
         presa_in_carico_da=v_name,
         presa_in_carico_il=now(),
         taken_by_user_id=v_uid,
         presa_in_carico_version=coalesce(presa_in_carico_version,0)+1,
         updated_at=now()
   where id=p_id and hotel_id=p_hotel_id and stato='aperta'
   returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.richieste_urgenti
    where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then
      raise exception 'Avviso urgente non trovato' using errcode='P0002';
    end if;
    raise exception 'Avviso già preso in carico da %', coalesce(v_row.presa_in_carico_da,'un altro utente') using errcode='P0001';
  end if;

  update public.urgent_reminder_jobs
     set status='cancelled', updated_at=now(), last_error=null
   where urgent_id=p_id and hotel_id=p_hotel_id and status in ('pending','processing');

  return v_row;
end;
$$;

create or replace function public.completa_urgente(p_id uuid, p_hotel_id text, p_nome text)
returns public.richieste_urgenti
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.richieste_urgenti;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode='28000';
  end if;
  if p_hotel_id is null or btrim(p_hotel_id) = '' then
    raise exception 'hotel_id mancante' using errcode='22023';
  end if;
  if not public.has_app_permission(p_hotel_id, 'urgent', 'complete') then
    raise exception 'Non autorizzato a completare questo avviso' using errcode='42501';
  end if;

  select coalesce(nullif(trim(p.display_name),''), nullif(trim(p_nome),''), 'Utente')
    into v_name
  from public.hotel_memberships hm
  left join public.profiles p on p.auth_user_id = hm.auth_user_id
  where hm.auth_user_id = v_uid
    and hm.hotel_id = p_hotel_id
    and hm.active = true
  limit 1;

  update public.richieste_urgenti
     set stato='completata',
         completata_da=v_name,
         completata_il=now(),
         completed_by_user_id=v_uid,
         updated_at=now()
   where id=p_id and hotel_id=p_hotel_id and stato in ('aperta','presa')
   returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.richieste_urgenti
    where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then
      raise exception 'Avviso urgente non trovato' using errcode='P0002';
    end if;
    return v_row;
  end if;

  update public.urgent_reminder_jobs
     set status='cancelled', updated_at=now(), last_error=null
   where urgent_id=p_id and hotel_id=p_hotel_id and status in ('pending','processing');

  return v_row;
end;
$$;

revoke execute on function public.prendi_urgente(uuid,text,text) from public, anon;
revoke execute on function public.completa_urgente(uuid,text,text) from public, anon;
grant execute on function public.prendi_urgente(uuid,text,text) to authenticated, service_role;
grant execute on function public.completa_urgente(uuid,text,text) to authenticated, service_role;

-- Statistiche globali: chi le legge deve poter amministrare ogni hotel attivo,
-- non soltanto possedere un singolo can_access_admin.
create or replace function public.get_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or exists (
    select 1
    from public.hotels h
    where coalesce(h.active,true)
      and not public.can_admin_hotel(h.id)
  ) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'db_size_bytes', pg_database_size(current_database()),
      'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
      'utenti', (select count(*) from public.utenti),
      'segnalazioni', (select count(*) from public.segnalazioni),
      'interventi', (select count(*) from public.interventi),
      'planning_lavori', (select count(*) from public.planning_lavori),
      'richieste_urgenti', (select count(*) from public.richieste_urgenti),
      'push_subscriptions', (select count(*) from public.push_subscriptions),
      'per_hotel', (
        select jsonb_object_agg(hotel_id, stats)
        from (
          select h.id as hotel_id,
                 jsonb_build_object(
                   'segnalazioni', (select count(*) from public.segnalazioni s where s.hotel_id=h.id),
                   'interventi', (select count(*) from public.interventi i where i.hotel_id=h.id),
                   'richieste_urgenti', (select count(*) from public.richieste_urgenti r where r.hotel_id=h.id)
                 ) as stats
          from public.hotels h
          where coalesce(h.active,true)
        ) x
      )
    )
  );
end;
$$;

revoke execute on function public.get_usage_stats() from public, anon;
grant execute on function public.get_usage_stats() to authenticated, service_role;
