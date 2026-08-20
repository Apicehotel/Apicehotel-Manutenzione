alter table public.utenti
  add column if not exists email text,
  add column if not exists phone_country_code text not null default '+39',
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_verified boolean not null default false;

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone_country_code text not null default '+39',
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_verified boolean not null default false;

update public.utenti
set phone_country_code = '+39'
where phone_country_code is null or btrim(phone_country_code) = '';

update public.profiles
set phone_country_code = '+39'
where phone_country_code is null or btrim(phone_country_code) = '';

alter table public.utenti
  drop constraint if exists utenti_phone_country_code_check,
  add constraint utenti_phone_country_code_check
  check (phone_country_code ~ '^\+[1-9][0-9]{0,3}$');

alter table public.profiles
  drop constraint if exists profiles_phone_country_code_check,
  add constraint profiles_phone_country_code_check
  check (phone_country_code ~ '^\+[1-9][0-9]{0,3}$');

alter table public.utenti
  drop constraint if exists utenti_telefono_e164_check,
  add constraint utenti_telefono_e164_check
  check (telefono is null or telefono = '' or telefono ~ '^\+[1-9][0-9]{7,14}$');

alter table public.profiles
  drop constraint if exists profiles_phone_e164_check,
  add constraint profiles_phone_e164_check
  check (phone is null or phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$');

create unique index if not exists utenti_email_unique_idx
  on public.utenti (lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists utenti_telefono_idx
  on public.utenti (telefono)
  where telefono is not null and telefono <> '';

create index if not exists profiles_phone_idx
  on public.profiles (phone)
  where phone is not null and phone <> '';
