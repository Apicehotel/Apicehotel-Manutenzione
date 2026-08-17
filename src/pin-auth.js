import { supabase } from './supabase.js'

function normalizeName(value) {
  return String(value || '').trim()
}

function normalizePin(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 4)
}

function mapUser(rawUser) {
  if (!rawUser) return null

  return {
    id: rawUser.id,
    legacyId: rawUser.legacy_id || null,
    name: rawUser.name || '',
    role: rawUser.role || 'segnalatore',
    department: rawUser.department || '',
    email: rawUser.email || '',
    phone: rawUser.phone || '',
    phoneCountryCode: rawUser.phone_country_code || '+39',
    canAdmin: Boolean(rawUser.can_admin),
    mustChangePin: Boolean(rawUser.must_change_pin),
    hotels: rawUser.hotel_id ? [rawUser.hotel_id] : [],
    active: true,
  }
}

export async function loginWithPin({
  name,
  pin,
  hotelId,
}) {
  if (!supabase) {
    throw new Error('Supabase non configurato')
  }

  const cleanName = normalizeName(name)
  const cleanPin = normalizePin(pin)

  if (!cleanName) {
    throw new Error('Inserisci il nome')
  }

  if (cleanPin.length !== 4) {
    throw new Error('Il PIN deve contenere 4 cifre')
  }

  if (!hotelId) {
    throw new Error('Struttura non valida')
  }

  const { data: directoryData, error: directoryError } =
    await supabase.functions.invoke('pin-auth', {
      method: 'GET',
      query: {
        hotel_id: hotelId,
      },
    })

  if (directoryError) {
    console.error(
      'pin-auth directory error',
      directoryError
    )
    throw new Error('Impossibile caricare gli utenti')
  }

  const directoryUsers = Array.isArray(
    directoryData?.users
  )
    ? directoryData.users
    : []

  const matched = directoryUsers.find(
    (user) =>
      String(user.name || '')
        .trim()
        .toLowerCase() === cleanName.toLowerCase()
  )

  if (!matched) {
    throw new Error('Utente o PIN non validi')
  }

  const { data, error } =
    await supabase.functions.invoke('pin-auth', {
      body: {
        hotel_id: hotelId,
        user_id: matched.id,
        pin: cleanPin,
      },
    })

  if (error) {
    console.error(
      'pin-auth login error',
      error
    )

    if (error?.context?.status === 429) {
      throw new Error(
        'Troppi tentativi. Riprova più tardi.'
      )
    }

    if (error?.context?.status === 403) {
      throw new Error(
        'Utente disattivato o non abilitato'
      )
    }

    throw new Error('Accesso non riuscito')
  }

  if (!data?.ok || !data?.user) {
    const message =
      data?.error ||
      'Utente o PIN non validi'

    throw new Error(message)
  }

  if (
    data.session?.access_token &&
    data.session?.refresh_token
  ) {
    const { error: sessionError } =
      await supabase.auth.setSession({
        access_token:
          data.session.access_token,
        refresh_token:
          data.session.refresh_token,
      })

    if (sessionError) {
      console.error(
        'setSession error',
        sessionError
      )
      throw new Error('Sessione non valida')
    }
  }

  return mapUser(data.user)
}

export async function logoutPinSession() {
  if (!supabase) return

  const { error } =
    await supabase.auth.signOut()

  if (error) {
    console.error(
      'logout error',
      error
    )
  }
}

export async function restorePinSession() {
  if (!supabase) return null

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (
    sessionError ||
    !session?.user
  ) {
    return null
  }

  const userId = session.user.id

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select(
      `
      auth_user_id,
      display_name,
      department,
      phone,
      phone_country_code,
      email,
      active
      `
    )
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (
    profileError ||
    !profile ||
    profile.active === false
  ) {
    await supabase.auth.signOut()
    return null
  }

  const {
    data: memberships,
    error: membershipsError,
  } = await supabase
    .from('hotel_memberships')
    .select(
      `
      hotel_id,
      role,
      active,
      can_access_admin
      `
    )
    .eq('auth_user_id', userId)
    .eq('active', true)

  if (membershipsError) {
    console.error(
      'restore memberships error',
      membershipsError
    )

    await supabase.auth.signOut()
    return null
  }

  const activeMemberships =
    memberships || []

  if (!activeMemberships.length) {
    await supabase.auth.signOut()
    return null
  }

  const primaryMembership =
    activeMemberships[0]

  return {
    id: userId,
    legacyId: null,
    name: profile.display_name || '',
    role:
      primaryMembership.role ||
      'segnalatore',
    department:
      profile.department || '',
    email: profile.email || '',
    phone: profile.phone || '',
    phoneCountryCode:
      profile.phone_country_code || '+39',
    canAdmin: activeMemberships.some(
      (item) =>
        item.can_access_admin === true ||
        item.role === 'admin'
    ),
    mustChangePin: false,
    hotels: activeMemberships.map(
      (item) => item.hotel_id
    ),
    active: true,
  }
}
