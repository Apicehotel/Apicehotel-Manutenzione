import { supabase } from './supabase.js'
import { getCachedCollection, setCachedCollection } from './offline-store.js'

function rowsFrom(data) { if (Array.isArray(data)) return data; if (Array.isArray(data?.users)) return data.users; if (Array.isArray(data?.data)) return data.data; return [] }
function loginDirectoryUsers(data, hotelId) {
  return rowsFrom(data)
    .filter((user) => user && user.active !== false)
    .map((user) => {
      const legacyId = user.legacy_id || user.id
      return {
        id: legacyId,
        legacy_id: legacyId,
        name: String(user.name || '').trim(),
        hotel_id: hotelId || user.hotel_id || null,
        active: true,
      }
    })
    .filter((user) => user.id && user.name)
}
function operationalUsers(data) { return rowsFrom(data).filter((user) => user && user.active !== false && String(user.role || '').trim() !== 'RandAI') }
async function invokeAdmin(body) { if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('admin-users', { body }); if (error) throw error; if (data?.error) throw new Error(data.error); return data }
async function invokeChatAdmin(body) { if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('admin-chat-settings', { body }); if (error) throw error; if (data?.error) throw new Error(data.error); return data }
async function invokeDirectory(hotelId) {
  const { data, error } = await supabase.functions.invoke('pin-auth', { body: { action: 'directory', hotel_id: hotelId } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
async function ownChatSettings() {
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('auth_user_id,chat_enabled,chat_can_create_groups').maybeSingle()
  return data || null
}
function mergeOwnChatSettings(users, settings) {
  if (!settings?.auth_user_id) return users
  return users.map((user) => user.auth_user_id === settings.auth_user_id || user.id === settings.auth_user_id
    ? { ...user, chat_enabled: Boolean(settings.chat_enabled), chat_can_create_groups: Boolean(settings.chat_can_create_groups) }
    : user)
}
export async function fetchLoginDirectory(hotelId) {
  if (!hotelId) return { users: [] }
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return { users: loginDirectoryUsers(await getCachedCollection('login-directory', hotelId), hotelId), offline: true }
  try {
    const users = loginDirectoryUsers(await invokeDirectory(hotelId), hotelId)
    await setCachedCollection('login-directory', hotelId, users)
    return { users }
  } catch (error) {
    const cached = loginDirectoryUsers(await getCachedCollection('login-directory', hotelId), hotelId)
    if (cached.length) return { users: cached, offline: true }
    throw error
  }
}
export async function fetchDirectory(hotelId) {
  if (!hotelId) return { users: [] }
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return { users: operationalUsers(await getCachedCollection('directory', hotelId)), offline: true }
  try {
    const baseUsers = operationalUsers(await invokeDirectory(hotelId))
    const settings = await ownChatSettings().catch(() => null)
    const users = mergeOwnChatSettings(baseUsers, settings)
    await setCachedCollection('directory', hotelId, users)
    return { users }
  } catch (error) {
    const cached = operationalUsers(await getCachedCollection('directory', hotelId))
    if (cached.length) return { users: cached, offline: true }
    throw error
  }
}
export async function fetchUsers(hotels) {
  const body = { action: 'list' }; if (Array.isArray(hotels) && hotels.length) body.hotels = hotels
  const data = await invokeAdmin(body)
  const users = rowsFrom(data)
  const chat = await invokeChatAdmin({ action: 'list', hotels: Array.isArray(hotels) ? hotels : [] }).catch(() => ({ settings: [] }))
  const byId = new Map((chat?.settings || []).map((row) => [row.auth_user_id, row]))
  return { users: users.map((user) => ({ ...user, ...(byId.get(user.id) || byId.get(user.auth_user_id) || {}), chat_enabled: Boolean((byId.get(user.id) || byId.get(user.auth_user_id))?.chat_enabled), chat_can_create_groups: Boolean((byId.get(user.id) || byId.get(user.auth_user_id))?.chat_can_create_groups) })) }
}
export async function insertUser(user) {
  const body = { action:'create', name:user.name, role:user.role, department:user.department||null, email:user.email||null, phone:user.phone||null, phone_country_code:user.phone_country_code||user.phoneCountryCode||null, pin:user.pin, hotels:Array.isArray(user.hotels)?user.hotels:[], can_access_admin:Boolean(user.can_access_admin??user.canAdmin??user.can_admin) }
  const data=await invokeAdmin(body); const created=data?.user||data?.data||data
  const authUserId=created?.id||created?.auth_user_id
  if(authUserId&&(user.chat_enabled||user.chat_can_create_groups)) await invokeChatAdmin({action:'update',auth_user_id:authUserId,chat_enabled:Boolean(user.chat_enabled),chat_can_create_groups:Boolean(user.chat_can_create_groups)})
  return created
}
export async function updateUserRow(authUserId, changes) {
  const body={action:'update',auth_user_id:authUserId}; for(const key of ['name','role','department','email','phone','hotels']) if(key in changes) body[key]=changes[key]; if('phone_country_code'in changes)body.phone_country_code=changes.phone_country_code;if('phoneCountryCode'in changes)body.phone_country_code=changes.phoneCountryCode;if('can_access_admin'in changes)body.can_access_admin=Boolean(changes.can_access_admin);if('canAdmin'in changes)body.can_access_admin=Boolean(changes.canAdmin);if('can_admin'in changes)body.can_access_admin=Boolean(changes.can_admin)
  const hasCoreChange=Object.keys(body).length>2
  const data=hasCoreChange?await invokeAdmin(body):null
  if('chat_enabled'in changes||'chat_can_create_groups'in changes) await invokeChatAdmin({action:'update',auth_user_id:authUserId,...('chat_enabled'in changes?{chat_enabled:Boolean(changes.chat_enabled)}:{}),...('chat_can_create_groups'in changes?{chat_can_create_groups:Boolean(changes.chat_can_create_groups)}:{})})
  return data?.user||data?.data||data||{auth_user_id:authUserId}
}
export async function updateUserPin(authUserId,pin){const data=await invokeAdmin({action:'set_pin',auth_user_id:authUserId,pin});return data?.user||data?.data||data}
export async function getTechnicianLink(authUserId,regenerate){const data=await invokeAdmin({action:'tech_link',auth_user_id:authUserId,regenerate:Boolean(regenerate)});return data?.token}
export async function setUserActive(authUserId,active){const data=await invokeAdmin({action:'set_active',auth_user_id:authUserId,active:Boolean(active)});return data?.user||data?.data||data}
export async function deleteUserRow(authUserId){return setUserActive(authUserId,false)}
export async function permanentlyDeleteUser(authUserId){return invokeAdmin({action:'hard_delete',auth_user_id:authUserId})}
