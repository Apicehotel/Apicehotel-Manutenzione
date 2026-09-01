update public.app_config
set value = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(value::jsonb, array['Governante','supplies'], '"side"'::jsonb, true),
                  array['Capo Governante','supplies'], '"side"'::jsonb, true),
                array['manutentore','supplies'], '"side"'::jsonb, true),
              array['admin','supplies'], '"side"'::jsonb, true)::text
where key='role_navigation_v1';
