-- Reliability Block 37 follow-up — sensitive RPC execution hardening.
-- inventory_adjust_stock is SECURITY DEFINER and must never be callable anonymously.

REVOKE ALL ON FUNCTION public.inventory_adjust_stock(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inventory_adjust_stock(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_adjust_stock(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_randapp_authorization_baseline()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_problem text;
BEGIN
  SELECT format('%I.%I has RLS disabled', n.nspname, c.relname)
    INTO v_problem
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = ANY (ARRAY[
      'segnalazioni','maintenance_issues','interventi','richieste_urgenti',
      'planning_lavori','planning_lavori_giorni','prenotazioni_sale',
      'inventory_items','camere_giorno','camere_lavoro','import_camere','tecnici'
    ])
    AND NOT c.relrowsecurity
  LIMIT 1;

  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: %', v_problem;
  END IF;

  SELECT format('%I.%I policy %I targets PUBLIC', schemaname, tablename, policyname)
    INTO v_problem
  FROM pg_policies
  WHERE schemaname = 'public'
    AND 'public' = ANY (roles)
  LIMIT 1;

  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: %', v_problem;
  END IF;

  SELECT format('%I still grants %s to %I', table_name, privilege_type, grantee)
    INTO v_problem
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  LIMIT 1;

  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: %', v_problem;
  END IF;

  IF has_function_privilege(
    'anon',
    'public.inventory_adjust_stock(uuid,numeric,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: anon can execute inventory_adjust_stock';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.inventory_adjust_stock(uuid,numeric,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: authenticated cannot execute inventory_adjust_stock';
  END IF;

  WITH required(table_name, cmd) AS (
    VALUES
      ('segnalazioni','SELECT'),('segnalazioni','INSERT'),('segnalazioni','UPDATE'),('segnalazioni','DELETE'),
      ('maintenance_issues','SELECT'),('maintenance_issues','INSERT'),('maintenance_issues','UPDATE'),('maintenance_issues','DELETE'),
      ('interventi','SELECT'),('interventi','INSERT'),('interventi','UPDATE'),('interventi','DELETE'),
      ('richieste_urgenti','SELECT'),('richieste_urgenti','INSERT'),('richieste_urgenti','UPDATE'),('richieste_urgenti','DELETE'),
      ('planning_lavori','SELECT'),('planning_lavori','INSERT'),('planning_lavori','UPDATE'),('planning_lavori','DELETE'),
      ('planning_lavori_giorni','SELECT'),('planning_lavori_giorni','INSERT'),('planning_lavori_giorni','UPDATE'),('planning_lavori_giorni','DELETE'),
      ('prenotazioni_sale','SELECT'),('prenotazioni_sale','INSERT'),('prenotazioni_sale','UPDATE'),('prenotazioni_sale','DELETE'),
      ('inventory_items','SELECT'),('inventory_items','INSERT'),('inventory_items','UPDATE'),('inventory_items','DELETE'),
      ('camere_giorno','SELECT'),('camere_giorno','INSERT'),('camere_giorno','UPDATE'),('camere_giorno','DELETE'),
      ('camere_lavoro','SELECT'),('camere_lavoro','INSERT'),('camere_lavoro','UPDATE'),('camere_lavoro','DELETE'),
      ('import_camere','SELECT'),('import_camere','INSERT'),('import_camere','UPDATE'),('import_camere','DELETE'),
      ('tecnici','SELECT'),('tecnici','INSERT'),('tecnici','UPDATE'),('tecnici','DELETE')
  )
  SELECT format('%I is missing %s RLS policy', r.table_name, r.cmd)
    INTO v_problem
  FROM required r
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = r.table_name
      AND (p.cmd = r.cmd OR p.cmd = 'ALL')
      AND 'authenticated' = ANY (p.roles)
  )
  LIMIT 1;

  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHZ_BASELINE_FAILED: %', v_problem;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.assert_randapp_authorization_baseline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_randapp_authorization_baseline() TO service_role;

SELECT public.assert_randapp_authorization_baseline();
