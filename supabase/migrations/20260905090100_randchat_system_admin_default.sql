-- The protected Randagio account cannot be edited from UsersTab by design.
-- Enable RandChat and group creation for that system account at schema rollout.
update public.profiles
set chat_enabled = true,
    chat_can_create_groups = true,
    updated_at = now()
where is_system_protected = true
  and display_name = 'Randagio';
