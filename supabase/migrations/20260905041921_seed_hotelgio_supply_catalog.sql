-- Bootstrap idempotente del catalogo Rifornimenti Hotel Giò.
-- Versione allineata alla migrazione già applicata su Supabase produzione.
-- La migrazione correttiva immediatamente successiva porta il catalogo alla lista reale completa.

with legacy_supply_products(category, name, sort_order) as (
  values
    ('minibar'::text, 'Coca Cola'::text, 10),
    ('minibar'::text, 'Succo ACE'::text, 20),
    ('minibar'::text, 'Birra'::text, 30),
    ('minibar'::text, 'Patatine'::text, 40),
    ('minibar'::text, 'Barretta'::text, 50),
    ('consumo'::text, 'Saponetta'::text, 110),
    ('consumo'::text, 'Shampini'::text, 120),
    ('consumo'::text, 'Spugne scarpe'::text, 130),
    ('consumo'::text, 'Cuffia doccia'::text, 140)
)
insert into public.supply_products (hotel_id, category, name, active, sort_order)
select 'hotelgio', p.category, p.name, true, p.sort_order
from legacy_supply_products p
where not exists (
  select 1
  from public.supply_products existing
  where existing.hotel_id = 'hotelgio'
    and lower(existing.name) = lower(p.name)
);
