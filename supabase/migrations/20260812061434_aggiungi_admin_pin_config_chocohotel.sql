insert into app_config (key, value)
values ('admin_pin', '0000')
on conflict (key) do nothing;
