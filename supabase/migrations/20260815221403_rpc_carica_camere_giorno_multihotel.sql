create or replace function public.carica_camere_giorno(p_hotel_id text, p_caricato_da text, p_camere jsonb)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_import_id uuid;
  v_n int;
  v_b2b int;
  r jsonb;
begin
  v_n := jsonb_array_length(p_camere);
  select count(*) into v_b2b
    from jsonb_array_elements(p_camere) e
    where e->>'stato_slope' = 'b2b';

  insert into public.import_camere (hotel_id, caricato_da, n_camere, n_b2b)
  values (p_hotel_id, p_caricato_da, v_n, v_b2b)
  returning id into v_import_id;

  -- Solo le camere di QUESTO hotel vengono azzerate e ricaricate.
  delete from public.camere_giorno where hotel_id = p_hotel_id;
  for r in select * from jsonb_array_elements(p_camere)
  loop
    insert into public.camere_giorno
      (hotel_id, camera, struttura, piano, tipologia, stato_slope, letti, note, arrivo, partenza, import_id)
    values (
      p_hotel_id,
      r->>'camera',
      r->>'struttura',
      (r->>'piano')::int,
      r->>'tipologia',
      coalesce(r->>'stato_slope','libera'),
      nullif(r->>'letti',''),
      nullif(r->>'note',''),
      nullif(r->>'arrivo',''),
      nullif(r->>'partenza',''),
      v_import_id
    );
  end loop;

  delete from public.camere_lavoro where hotel_id = p_hotel_id;
  insert into public.camere_lavoro (hotel_id, camera, stato)
  select p_hotel_id, camera,
         case when stato_slope = 'libera' then 'fatto' else 'dafare' end
  from public.camere_giorno where hotel_id = p_hotel_id;

  -- Aggiorna lo stato_camera delle segnalazioni ancora aperte di questo hotel.
  update public.segnalazioni s
  set stato_camera = case cg.stato_slope
        when 'libera'   then 'libera'
        when 'arrivo'   then 'arrivo'
        when 'partenza' then 'fermata_cliente'
        when 'fermata'  then 'fermata_cliente'
        when 'b2b'      then 'fermata_cliente'
        else s.stato_camera
      end
  from public.camere_giorno cg
  where cg.camera = s.camera
    and cg.hotel_id = s.hotel_id
    and s.hotel_id = p_hotel_id
    and s.stato in ('todo', 'waiting', 'tecnico');

  return v_import_id;
end;
$function$;
