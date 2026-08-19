import { supabase } from './supabase.js'

function fromDbUser(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    nome: row.nome,
    ruolo: row.ruolo,
    reparto: row.reparto || '',
    telefono: row.telefono || '',
    attivo: row.attivo !== false,
    systemRole: row.system_role || null,
  }
}

function normalizeUsers(data) {
  const rows = Array.isArray(data) ? data : data?.users || data?.data || []
  return rows.map(fromDbUser)
}

async function invokeAdmin(action, payload = {}) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function loadLoginUsers(hotelId) {
  if (!supabase || !hotelId) return []
  const { data, error } = await supabase.functions.invoke('pin-auth', {
    body: { action: 'directory', hotel_id: hotelId },
  })
  if (error) throw error
  return normalizeUsers(data)
}

export async function loadUsers(hotelId) {
  const data = await invokeAdmin('list', hotelId ? { hotel_id: hotelId } : {})
  return normalizeUsers(data)
}

export async function createUser(user) {
  const data = await invokeAdmin('create', {
    user: {
      id: user.id,
      hotel_id: user.hotelId,
      nome: user.nome,
      ruolo: user.ruolo,
      reparto: user.reparto || '',
      telefono: user.telefono || '',
      attivo: user.attivo !== false,
    },
  })
  const row = data?.user || data?.data || data
  return fromDbUser(row)
}

export async function updateUser(id, patch) {
  const user = {}
  if ('hotelId' in patch) user.hotel_id = patch.hotelId
  if ('nome' in patch) user.nome = patch.nome
  if ('ruolo' in patch) user.ruolo = patch.ruolo
  if ('reparto' in patch) user.reparto = patch.reparto
  if ('telefono' in patch) user.telefono = patch.telefono
  const data = await invokeAdmin('update', { user_id: id, user })
  const row = data?.user || data?.data || data
  return fromDbUser(row)
}

export async function setUserPin(id, pin) {
  await invokeAdmin('set_pin', { user_id: id, pin })
  return true
}

export async function setUserActive(id, attivo) {
  await invokeAdmin('set_active', { user_id: id, active: !!attivo })
  return true
}

export async function deleteUser(id) {
  return setUserActive(id, false)
}
