import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260905090000_randchat_group_a_foundation.sql')
const usersData = read('src/users-data.js')
const usersTab = read('src/randapp/admin/UsersTab.jsx')
const nav = read('src/randapp/nav.js')
const shell = read('src/randapp/Shell.jsx')
const chatData = read('src/randapp/chat/chat-data.js')
const adminChat = read('supabase/functions/admin-chat-settings/index.ts')

test('RandChat enablement is per-user and admin-managed', () => {
  assert.match(migration, /chat_enabled boolean not null default false/i)
  assert.match(migration, /chat_can_create_groups boolean not null default false/i)
  assert.match(migration, /protect_admin_managed_chat_profile_fields/i)
  assert.match(adminChat, /requireAdmin\(req/)
  assert.match(usersTab, /Chat \{u\.chat_enabled\?'ON':'OFF'\}/)
  assert.match(usersData, /admin-chat-settings/)
})

test('group retention is constrained to 30 or 60 days and pinned messages survive cleanup', () => {
  assert.match(migration, /retention_days in \(30, 60\)/i)
  assert.match(migration, /m\.pinned_at is null/i)
  assert.match(migration, /cron\.schedule\([\s\S]*randchat-group-retention/i)
  assert.match(migration, /retention_cleanup/i)
  assert.doesNotMatch(migration.match(/cleanup_expired_group_chat_messages[\s\S]*?revoke all on function public\.cleanup_expired_group_chat_messages/)?.[0] || '', /before_state|body/)
})

test('cross-hotel chat membership does not grant hotel membership', () => {
  const addMember = migration.match(/create or replace function public\.chat_add_group_member[\s\S]*?create or replace function public\.chat_remove_group_member/)?.[0] || ''
  assert.match(addMember, /chat_group_members/i)
  assert.doesNotMatch(addMember, /insert into public\.hotel_memberships/i)
  assert.doesNotMatch(addMember, /update public\.hotel_memberships/i)
  assert.match(migration, /chat_list_directory\(\)/i)
  assert.match(migration, /returns table\(auth_user_id uuid, display_name text, hotel_ids text\[\]\)/i)
})

test('group access is enforced by RLS and group membership', () => {
  assert.match(migration, /alter table public\.chat_groups enable row level security/i)
  assert.match(migration, /alter table public\.chat_group_members enable row level security/i)
  assert.match(migration, /alter table public\.chat_messages enable row level security/i)
  assert.match(migration, /chat_group_member\(group_id, auth\.uid\(\)\)/i)
  assert.match(migration, /sender_user_id = auth\.uid\(\)/i)
})

test('RandChat groups are mounted only for chat-enabled users', () => {
  assert.match(nav, /id: 'chat'[\s\S]*show: Boolean\(user\.chat_enabled\)/)
  assert.match(nav, /chat: \(u\) => Boolean\(u\?\.chat_enabled\)/)
  assert.match(shell, /import\('\.\/chat\/ChatGroups\.jsx'\)/)
  assert.match(shell, /view === 'chat'/)
  assert.match(chatData, /chat_create_group/)
  assert.match(chatData, /chat_add_group_member/)
  assert.match(chatData, /postgres_changes/)
})
