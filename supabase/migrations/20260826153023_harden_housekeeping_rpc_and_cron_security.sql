REVOKE ALL ON FUNCTION public.carica_camere_giorno(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.carica_camere_giorno(text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carica_camere_giorno(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.carica_camere_giorno(
  p_hotel_id text,
  p_caricato_da text,
  p_camere jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_authorized boolean := false;
  v_import_id uuid;
  v_n int;
  v_b2b int;
  r jsonb;
  v_struttura text;
  v_piano int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non autenticato' USING errcode = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.hotel_memberships hm
    WHERE hm.auth_user_id = v_uid
      AND hm.hotel_id = p_hotel_id
      AND hm.active = true
      AND (
        hm.can_access_admin = true
        OR hm.role IN (
          'admin','Supremo','Responsabile','Direzione','Reception',
          'Governante','Capo Governante','manutentore'
        )
      )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Non autorizzato a importare le camere per questa struttura'
      USING errcode = '42501';
  END IF;

  IF p_hotel_id IS NULL OR btrim(p_hotel_id) = '' THEN
    RAISE EXCEPTION 'hotel_id mancante' USING errcode = '22023';
  END IF;

  IF p_camere IS NULL OR jsonb_typeof(p_camere) <> 'array' THEN
    RAISE EXCEPTION 'Formato camere non valido' USING errcode = '22023';
  END IF;

  v_n := jsonb_array_length(p_camere);
  SELECT count(*) INTO v_b2b
  FROM jsonb_array_elements(p_camere) e
  WHERE e->>'stato_slope' = 'b2b';

  INSERT INTO public.import_camere (hotel_id, caricato_da, n_camere, n_b2b)
  VALUES (p_hotel_id, p_caricato_da, v_n, v_b2b)
  RETURNING id INTO v_import_id;

  DELETE FROM public.camere_giorno WHERE hotel_id = p_hotel_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_camere)
  LOOP
    v_struttura := coalesce(nullif(r->>'struttura',''), nullif(r->>'gruppo',''), 'Generale');
    BEGIN
      v_piano := nullif(r->>'piano','')::int;
    EXCEPTION WHEN others THEN
      v_piano := null;
    END;
    IF v_piano IS NULL THEN
      BEGIN
        v_piano := nullif(substring(v_struttura from '(?:^|[^0-9])([0-9]+)(?:[^0-9]|$)'),'')::int;
      EXCEPTION WHEN others THEN
        v_piano := 0;
      END;
    END IF;
    IF v_piano IS NULL THEN v_piano := 0; END IF;

    INSERT INTO public.camere_giorno
      (hotel_id, camera, struttura, piano, tipologia, stato_slope, letti, note, arrivo, partenza, import_id)
    VALUES (
      p_hotel_id,
      r->>'camera',
      v_struttura,
      v_piano,
      r->>'tipologia',
      coalesce(r->>'stato_slope','libera'),
      nullif(r->>'letti',''),
      nullif(r->>'note',''),
      nullif(r->>'arrivo',''),
      nullif(r->>'partenza',''),
      v_import_id
    );
  END LOOP;

  DELETE FROM public.camere_lavoro WHERE hotel_id = p_hotel_id;
  INSERT INTO public.camere_lavoro (hotel_id, camera, stato)
  SELECT p_hotel_id, camera,
         CASE WHEN stato_slope = 'libera' THEN 'fatto' ELSE 'dafare' END
  FROM public.camere_giorno
  WHERE hotel_id = p_hotel_id;

  UPDATE public.segnalazioni s
  SET stato_camera = CASE cg.stato_slope
        WHEN 'libera'   THEN 'libera'
        WHEN 'arrivo'   THEN 'arrivo'
        WHEN 'partenza' THEN 'fermata_cliente'
        WHEN 'fermata'  THEN 'fermata_cliente'
        WHEN 'b2b'      THEN 'fermata_cliente'
        ELSE s.stato_camera
      END
  FROM public.camere_giorno cg
  WHERE cg.camera = s.camera
    AND cg.hotel_id = s.hotel_id
    AND s.hotel_id = p_hotel_id
    AND s.stato IN ('todo', 'waiting', 'tecnico');

  RETURN v_import_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.carica_camere_giorno(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.carica_camere_giorno(text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.carica_camere_giorno(text, text, jsonb) TO authenticated, service_role;

ALTER FUNCTION public.set_row_updated_at() SET search_path TO public;

UPDATE public.edge_function_secrets
SET value = encode(gen_random_bytes(32), 'hex')
WHERE key = 'urgent_reminder_cron_secret';

SELECT cron.alter_job(
  4,
  schedule := '30 seconds',
  command := $cron$
    select net.http_post(
      url := 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/urgent-reminder-worker',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select value from public.edge_function_secrets where key='urgent_reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$,
  database := NULL,
  username := NULL,
  active := true
);

CREATE INDEX IF NOT EXISTS housekeeping_change_events_changed_by_user_id_idx
  ON public.housekeeping_change_events (changed_by_user_id);

CREATE INDEX IF NOT EXISTS housekeeping_completions_housekeeper_user_id_idx
  ON public.housekeeping_completions (housekeeper_user_id);
