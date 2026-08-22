import { supabase } from './supabase.js'

function rowsFrom(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.users)) return data.users
  if (Array.isArray(data?.data)) return data.data
  return []
}

async function invokeAdmin(body) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchDirectory(hotelId) {
  if (!supabase || !hotelId) return { users: [] }
  const { data, error } = await supabase.functions.invoke('pin-auth', {
    body: { action: 'directory', hotel_id: hotelId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { users: rowsFrom(data) }
}

export async function fetchUsers(hotels) {
  const body = { action: 'list' }
  if (Array.isArray(hotels) && hotels.length) body.hotels = hotels
  const data = await invokeAdmin(body)
  return { users: rowsFrom(data) }
}

export async function insertUser(user) {
  const body = {
    action: 'create',
    name: user.name,
    role: user.role,
    department: user.department || null,
    email: user.email || null,
    phone: user.phone || null,
    phone_country_code: user.phone_country_code || user.phoneCountryCode || null,
    pin: user.pin,
    hotels: Array.isArray(user.hotels) ? user.hotels : [],
    can_access_admin: Boolean(user.can_access_admin ?? user.canAdmin ?? user.can_admin),
  }
  const data = await invokeAdmin(body)
  return data?.user || data?.data || data
}

export async function updateUserRow(authUserId, changes) {
  const body = { action: 'update', auth_user_id: authUserId }
  for (const key of ['name', 'role', 'department', 'email', 'phone', 'hotels']) {
    if (key in changes) body[key] = changes[key]
  }
  if ('phone_country_code' in changes) body.phone_country_code = changes.phone_country_code
  if ('phoneCountryCode' in changes) body.phone_country_code = changes.phoneCountryCode
  if ('can_access_admin' in changes) body.can_access_admin = Boolean(changes.can_access_admin)
  if ('canAdmin' in changes) body.can_access_admin = Boolean(changes.canAdmin)
  if ('can_admin' in changes) body.can_access_admin = Boolean(changes.can_admin)
  const data = await invokeAdmin(body)
  return data?.user || data?.data || data
}

export async function updateUserPin(authUserId, pin) {
  const data = await invokeAdmin({ action: 'set_pin', auth_user_id: authUserId, pin })
  return data?.user || data?.data || data
}

export async function getTechnicianLink(authUserId, regenerate) {
  const data = await invokeAdmin({ action: 'tech_link', auth_user_id: authUserId, regenerate: Boolean(regenerate) })
  return data?.token
}

export async function setUserActive(authUserId, active) {
  const data = await invokeAdmin({ action: 'set_active', auth_user_id: authUserId, active: Boolean(active) })
  return data?.user || data?.data || data
}

// Compatibilità con eventuali import storici: non elimina mai fisicamente.
export async function deleteUserRow(authUserId) {
  return setUserActive(authUserId, false)
}
