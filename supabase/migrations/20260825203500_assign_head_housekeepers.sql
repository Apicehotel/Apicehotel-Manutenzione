-- Assegnazioni iniziali Capo Governante. Il ruolo mantiene gli stessi permessi
-- operativi di Governante; abilita soltanto il canale ntfy Housekeeping.
update public.hotel_memberships hm
set role = 'Capo Governante'
from public.profiles p
where p.auth_user_id = hm.auth_user_id
  and hm.hotel_id = 'hotelgio'
  and lower(trim(p.display_name)) = 'giulia'
  and hm.active = true;

update public.hotel_memberships hm
set role = 'Capo Governante'
from public.profiles p
where p.auth_user_id = hm.auth_user_id
  and hm.hotel_id = 'chocohotel'
  and lower(trim(p.display_name)) = 'veronica'
  and hm.active = true;
