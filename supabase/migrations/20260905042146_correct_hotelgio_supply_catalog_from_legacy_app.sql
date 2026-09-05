-- Allinea il catalogo Hotel Giò alla precedente app operativa Rifornimento Hotel.
-- Corregge soltanto le voci bootstrap note e aggiunge quelle mancanti.

update public.supply_products
set name = 'Saponette', sort_order = 120, updated_at = now()
where hotel_id = 'hotelgio' and category = 'consumo' and name = 'Saponetta'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Saponette'));

update public.supply_products
set name = 'Shampoo', sort_order = 130, updated_at = now()
where hotel_id = 'hotelgio' and category = 'consumo' and name = 'Shampini'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Shampoo'));

update public.supply_products
set name = 'Cuffie doccia', sort_order = 140, updated_at = now()
where hotel_id = 'hotelgio' and category = 'consumo' and name = 'Cuffia doccia'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Cuffie doccia'));

update public.supply_products
set name = 'Succo di frutta', sort_order = 40, updated_at = now()
where hotel_id = 'hotelgio' and category = 'minibar' and name = 'Succo ACE'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Succo di frutta'));

update public.supply_products
set name = 'Barrette', sort_order = 60, updated_at = now()
where hotel_id = 'hotelgio' and category = 'minibar' and name = 'Barretta'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Barrette'));

update public.supply_products
set name = 'Birre', sort_order = 70, updated_at = now()
where hotel_id = 'hotelgio' and category = 'minibar' and name = 'Birra'
  and not exists (select 1 from public.supply_products x where x.hotel_id='hotelgio' and lower(x.name)=lower('Birre'));

with canonical(category, name, sort_order) as (
  values
    ('minibar'::text, 'Acqua naturale'::text, 10),
    ('minibar'::text, 'Acqua frizzante'::text, 20),
    ('minibar'::text, 'Coca Cola'::text, 30),
    ('minibar'::text, 'Succo di frutta'::text, 40),
    ('minibar'::text, 'Patatine'::text, 50),
    ('minibar'::text, 'Barrette'::text, 60),
    ('minibar'::text, 'Birre'::text, 70),
    ('consumo'::text, 'Carta igienica'::text, 110),
    ('consumo'::text, 'Saponette'::text, 120),
    ('consumo'::text, 'Shampoo'::text, 130),
    ('consumo'::text, 'Cuffie doccia'::text, 140),
    ('consumo'::text, 'Spugne scarpe'::text, 150),
    ('consumo'::text, 'Sacchi neri 60x50'::text, 160),
    ('consumo'::text, 'Sacchi bianchi 60x50'::text, 170),
    ('consumo'::text, 'Sacchi neri 110x70'::text, 180),
    ('consumo'::text, 'Carta Lucart/Scottex'::text, 190)
)
insert into public.supply_products (hotel_id, category, name, active, sort_order)
select 'hotelgio', c.category, c.name, true, c.sort_order
from canonical c
where not exists (
  select 1 from public.supply_products p
  where p.hotel_id='hotelgio' and lower(p.name)=lower(c.name)
);

with canonical(category, name, sort_order) as (
  values
    ('minibar'::text, 'Acqua naturale'::text, 10),
    ('minibar'::text, 'Acqua frizzante'::text, 20),
    ('minibar'::text, 'Coca Cola'::text, 30),
    ('minibar'::text, 'Succo di frutta'::text, 40),
    ('minibar'::text, 'Patatine'::text, 50),
    ('minibar'::text, 'Barrette'::text, 60),
    ('minibar'::text, 'Birre'::text, 70),
    ('consumo'::text, 'Carta igienica'::text, 110),
    ('consumo'::text, 'Saponette'::text, 120),
    ('consumo'::text, 'Shampoo'::text, 130),
    ('consumo'::text, 'Cuffie doccia'::text, 140),
    ('consumo'::text, 'Spugne scarpe'::text, 150),
    ('consumo'::text, 'Sacchi neri 60x50'::text, 160),
    ('consumo'::text, 'Sacchi bianchi 60x50'::text, 170),
    ('consumo'::text, 'Sacchi neri 110x70'::text, 180),
    ('consumo'::text, 'Carta Lucart/Scottex'::text, 190)
)
update public.supply_products p
set category=c.category, sort_order=c.sort_order, active=true, updated_at=now()
from canonical c
where p.hotel_id='hotelgio' and lower(p.name)=lower(c.name);
