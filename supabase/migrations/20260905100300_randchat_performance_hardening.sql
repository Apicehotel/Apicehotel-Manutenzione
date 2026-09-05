-- RandChat performance hardening from Supabase Database Advisor.
-- Scope is intentionally limited to RandChat tables/policies.

-- Cover foreign keys used by cascades, joins and deletes.
create index if not exists chat_dm_envelopes_device_user_idx
  on public.chat_dm_envelopes(device_row_id, recipient_user_id);
create index if not exists chat_dm_messages_sender_device_user_idx
  on public.chat_dm_messages(sender_device_id, sender_user_id);
create index if not exists chat_dm_messages_sender_user_idx
  on public.chat_dm_messages(sender_user_id);
create index if not exists chat_dm_threads_created_by_idx
  on public.chat_dm_threads(created_by);
create index if not exists chat_group_members_added_by_idx
  on public.chat_group_members(added_by) where added_by is not null;
create index if not exists chat_groups_created_by_idx
  on public.chat_groups(created_by);
create index if not exists chat_issue_links_group_idx
  on public.chat_issue_links(group_id) where group_id is not null;
create index if not exists chat_issue_links_group_message_idx
  on public.chat_issue_links(group_message_id) where group_message_id is not null;
create index if not exists chat_issue_links_dm_thread_idx
  on public.chat_issue_links(dm_thread_id) where dm_thread_id is not null;
create index if not exists chat_issue_links_dm_message_idx
  on public.chat_issue_links(dm_message_id) where dm_message_id is not null;
create index if not exists chat_issue_links_hotel_idx
  on public.chat_issue_links(hotel_id);
create index if not exists chat_issue_links_linked_by_idx
  on public.chat_issue_links(linked_by);
create index if not exists chat_messages_sender_user_idx
  on public.chat_messages(sender_user_id);
create index if not exists chat_messages_pinned_by_idx
  on public.chat_messages(pinned_by) where pinned_by is not null;

-- Cache auth.uid() once per statement instead of re-evaluating it per row.
drop policy if exists chat_groups_member_select on public.chat_groups;
create policy chat_groups_member_select on public.chat_groups
for select to authenticated
using (public.chat_group_member(id, (select auth.uid())));

drop policy if exists chat_group_members_member_select on public.chat_group_members;
create policy chat_group_members_member_select on public.chat_group_members
for select to authenticated
using (public.chat_group_member(group_id, (select auth.uid())));

drop policy if exists chat_messages_member_select on public.chat_messages;
create policy chat_messages_member_select on public.chat_messages
for select to authenticated
using (public.chat_group_member(group_id, (select auth.uid())));

drop policy if exists chat_messages_member_insert on public.chat_messages;
create policy chat_messages_member_insert on public.chat_messages
for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and public.chat_group_member(group_id, (select auth.uid()))
);

drop policy if exists chat_messages_sender_or_admin_delete on public.chat_messages;
create policy chat_messages_sender_or_admin_delete on public.chat_messages
for delete to authenticated
using (
  sender_user_id = (select auth.uid())
  or public.chat_group_admin(group_id, (select auth.uid()))
);

drop policy if exists chat_dm_devices_self_select on public.chat_dm_devices;
create policy chat_dm_devices_self_select on public.chat_dm_devices
for select to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists chat_dm_threads_participant_select on public.chat_dm_threads;
create policy chat_dm_threads_participant_select on public.chat_dm_threads
for select to authenticated
using (public.chat_dm_participant(id, (select auth.uid())));

drop policy if exists chat_dm_messages_participant_select on public.chat_dm_messages;
create policy chat_dm_messages_participant_select on public.chat_dm_messages
for select to authenticated
using (expires_at > now() and public.chat_dm_participant(thread_id, (select auth.uid())));

drop policy if exists chat_dm_envelopes_recipient_select on public.chat_dm_envelopes;
create policy chat_dm_envelopes_recipient_select on public.chat_dm_envelopes
for select to authenticated
using (recipient_user_id = (select auth.uid()));

drop policy if exists chat_issue_links_scoped_select on public.chat_issue_links;
create policy chat_issue_links_scoped_select on public.chat_issue_links
for select to authenticated
using (
  public.is_hotel_member(hotel_id)
  and (
    (source_type = 'group' and group_id is not null and public.chat_group_member(group_id, (select auth.uid())))
    or
    (source_type = 'dm' and dm_thread_id is not null and public.chat_dm_participant(dm_thread_id, (select auth.uid())))
  )
);
