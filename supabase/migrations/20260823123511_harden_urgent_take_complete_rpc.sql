create or replace function public.prendi_urgente(p_id uuid, p_hotel_id text, p_nome text)
returns public.richieste_urgenti
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_row public.richieste_urgenti;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode='28000';
  end if;

  select hm.role, coalesce(nullif(trim(p.display_name),''), nullif(trim(p_nome),''), 'Utente')
    into v_role, v_name
  from public.hotel_memberships hm
  left join public.profiles p on p.auth_user_id = hm.auth_user_id
  where hm.auth_user_id = v_uid
    and hm.hotel_id = p_hotel_id
    and hm.active = true
  limit 1;

  if v_role is null or v_role not in ('admin','manutentore','Responsabile','Direzione','Direttore Centro Congressi','Portiere Notturno','Reception') then
    raise exception 'Non autorizzato a prendere in carico questo avviso' using errcode='42501';
  end if;

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
    select * into v_row from public.richieste_urgenti where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then
      raise exception 'Avviso urgente non trovato' using errcode='P0002';
    end if;
    raise exception 'Avviso già preso in carico da %', coalesce(v_row.presa_in_carico_da,'un altro utente') using errcode='P0001';
  end if;

  update public.urgent_reminder_jobs
     set status='cancelled', updated_at=now(), last_error=null
   where urgent_id=p_id and status in ('pending','processing');

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
  v_role text;
  v_name text;
  v_row public.richieste_urgenti;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode='28000';
  end if;

  select hm.role, coalesce(nullif(trim(p.display_name),''), nullif(trim(p_nome),''), 'Utente')
    into v_role, v_name
  from public.hotel_memberships hm
  left join public.profiles p on p.auth_user_id = hm.auth_user_id
  where hm.auth_user_id = v_uid
    and hm.hotel_id = p_hotel_id
    and hm.active = true
  limit 1;

  if v_role is null or v_role not in ('admin','manutentore','Responsabile','Direzione','Direttore Centro Congressi','Portiere Notturno','Reception') then
    raise exception 'Non autorizzato a completare questo avviso' using errcode='42501';
  end if;

  update public.richieste_urgenti
     set stato='completata',
         completata_da=v_name,
         completata_il=now(),
         completed_by_user_id=v_uid,
         updated_at=now()
   where id=p_id and hotel_id=p_hotel_id and stato in ('aperta','presa')
   returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.richieste_urgenti where id=p_id and hotel_id=p_hotel_id;
    if v_row.id is null then
      raise exception 'Avviso urgente non trovato' using errcode='P0002';
    end if;
    return v_row;
  end if;

  update public.urgent_reminder_jobs
     set status='cancelled', updated_at=now(), last_error=null
   where urgent_id=p_id and status in ('pending','processing');

  return v_row;
end;
$$;

grant execute on function public.prendi_urgente(uuid,text,text) to authenticated;
grant execute on function public.completa_urgente(uuid,text,text) to authenticated;
