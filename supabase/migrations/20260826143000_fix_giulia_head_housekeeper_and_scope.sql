-- Corregge l'assegnazione Capo Governante di Hotel Giò anche quando il profilo
-- contiene cognome/spazi aggiuntivi. Il ruolo è sempre limitato alla membership
-- della singola struttura: non viene propagato agli altri hotel.
update public.hotel_memberships hm
set role = 'Capo Governante'
from public.profiles p
where p.auth_user_id = hm.auth_user_id
  and hm.hotel_id = 'hotelgio'
  and hm.active = true
  and p.active = true
  and lower(regexp_replace(trim(p.display_name), '\s+', ' ', 'g')) ~ '^giulia(?:\s|$)';

-- Mantiene esplicitamente separati i ruoli Housekeeping per struttura.
-- Ogni membership conserva il proprio ruolo; nessun aggiornamento cross-hotel.
comment on column public.hotel_memberships.role is
  'Ruolo per singola struttura. Governante/Capo Governante sono assegnati per hotel, non globalmente.';
