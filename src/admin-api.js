import { supabase } from './supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase non configurato')
}

async function invokeAdmin(body) {
  requireSupabase()

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
  })

  if (error) {
    console.error('admin-users error', error)

    const status = error?.context?.status

    if (status === 401) {
      throw new Error('Sessione scaduta. Accedi di nuovo.')
    }

    if (status === 403) {
      throw new Error('Permesso amministratore richiesto')
    }

    throw new Error('Errore gestione utenti')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Errore gestione utenti')
  }

  return data
}

export async function createRemoteUser({
  name,
  role,
  department,
  pin,
  hotels,
  email = '',
  phone = '',
  phoneCountryCode = '+39',
  canAccessAdmin = false,
}) {
  const data = await invokeAdmin({
    action: 'create',
    name,
    role,
    department: department || null,
    pin,
    hotels,
    email: email || null,
    phone: phone || null,
    phone_country_code: phoneCountryCode || '+39',
    can_access_admin: canAccessAdmin,
  })

  return data.user
}

export async function updateRemoteUser(authUserId, changes) {
  await invokeAdmin({
    action: 'update',
    auth_user_id: authUserId,
    ...changes,
  })

  return true
}

export async function setRemoteUserPin(
  authUserId,
  pin,
  mustChangePin = false
) {
  await invokeAdmin({
    action: 'set_pin',
    auth_user_id: authUserId,
    pin,
    must_change_pin: mustChangePin,
  })

  return true
}

export async function setRemoteUserActive(
  authUserId,
  active,
  reason = null
) {
  await invokeAdmin({
    action: 'set_active',
    auth_user_id: authUserId,
    active,
    reason,
  })

  return true
}

export async function changeMyPin(currentPin, newPin) {
  requireSupabase()

  const { data, error } = await supabase.functions.invoke('user-pin', {
    body: {
      current_pin: currentPin,
      new_pin: newPin,
    },
  })

  if (error) {
    console.error('user-pin error', error)

    const status = error?.context?.status

    if (status === 401) {
      throw new Error(data?.error || 'PIN attuale non valido')
    }

    if (status === 429) {
      throw new Error('Troppi tentativi. Riprova più tardi.')
    }

    throw new Error('Errore cambio PIN')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Errore cambio PIN')
  }

  return true
}
