create index if not exists inventory_intervention_parts_movement_idx on public.inventory_intervention_parts(movement_id) where movement_id is not null;
