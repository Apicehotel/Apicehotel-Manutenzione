update public.randai_hvac_zones
set room_numbers = array(select n from generate_series(1101,1121) n where n not in (1113,1117))
where zone_id = 'hotelgio-jazz-p1';

update public.randai_hvac_zones
set room_numbers = array(select n from generate_series(2201,2221) n where n not in (2213,2217))
where zone_id = 'hotelgio-jazz-p2';

update public.randai_hvac_zones
set room_numbers = array(select n from generate_series(3301,3321) n where n not in (3313,3317))
where zone_id = 'hotelgio-jazz-p3';

update public.randai_hvac_zones
set room_numbers = array(select n from generate_series(4401,4421) n where n not in (4413,4417))
where zone_id = 'hotelgio-jazz-p4';
