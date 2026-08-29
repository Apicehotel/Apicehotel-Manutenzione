alter table public.sensori_temperatura
  add column if not exists switch_state text null;

alter table public.sensori_temperatura
  drop constraint if exists sensori_temperatura_switch_state_check;

alter table public.sensori_temperatura
  add constraint sensori_temperatura_switch_state_check
  check (switch_state is null or switch_state in ('on','off','mixed'));

comment on column public.sensori_temperatura.switch_state is
  'Stato reale relay eWeLink. NULL per dispositivi senza stato switch; on/off per relay singoli; mixed per multicanale con stati differenti.';
