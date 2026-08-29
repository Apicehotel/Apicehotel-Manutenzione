revoke all privileges on table public.randai_credentials from anon, authenticated;
revoke all privileges on table public.randai_hvac_zones from anon, authenticated;

create index if not exists randai_documents_equipment_id_idx on public.randai_documents (equipment_id);
create index if not exists randai_memory_equipment_id_idx on public.randai_memory (equipment_id);
create index if not exists randai_sensor_bindings_equipment_id_idx on public.randai_sensor_bindings (equipment_id);
