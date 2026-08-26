-- Reset PIN di default a 0000 per tutti gli utenti attivi non protetti.
-- must_change_pin=true: flag informativo sul database, non ancora applicato
-- da un flusso di forzatura lato client (nessuna UI blocca il login finche'
-- il PIN non viene cambiato). Gli utenti cambiano il PIN da soli da
-- "Cambia PIN" quando vogliono.
update public.auth_pin_credentials c
set pin_hash = crypt('0000', gen_salt('bf', 11)),
    must_change_pin = true,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now()
from public.profiles p
where p.auth_user_id = c.auth_user_id
  and p.active = true
  and p.is_system_protected = false;
