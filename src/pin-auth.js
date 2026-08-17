import { supabase } from './supabase.js'

function normalizeName(value) {
  return String(value || '').trim()
}

function normalizePin(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4)
}

function mapProfile(profile, memberships = []) {
  const hotels = memberships
    .filter((item) => item.active !== false)
    .map((item) => item.hotel_id)

  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    department: profile.department || '',
    email: profile.email || '',
    phone: profile.phone || '',
    phoneCountryCode: profile.phone_country_code || '+39',
    active: profile.active !== false,
    hotels,
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

  const { data, error } = await supabase.functions.invoke('pin-auth', {
    body: {
      name: cleanName,
      pin: cleanPin,
      hotelId,
    },
  })

  if (error) {
    console.error('pin-auth invoke error', error)
    throw new Error('Accesso non riuscito')
  }

  if (!data?.ok) {
    const message =
      data?.error === 'invalid_credentials'
        ? 'Utente o PIN non validi'
        : data?.error === 'inactive_user'
          ? 'Utente disattivato'
          : data?.error === 'hotel_not_allowed'
            ? 'Utente non abilitato per questa struttura'
            : data?.error === 'too_many_attempts'
              ? 'Troppi tentativi. Riprova più tardi.'
              : 'Accesso non riuscito'

    throw new Error(message)
  }

  if (data.session?.access_token && data.session?.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })

    if (sessionError) {
      console.error('setSession error', sessionError)
      throw new Error('Sessione non valida')
    }
  }

  let profile = data.profile || null
  let memberships = data.memberships || []

  if (!profile) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Profilo utente non disponibile')
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('profile load error', profileError)
      throw new Error('Impossibile caricare il profilo')
    }

    profile = profileRow
  }

  if (!memberships.length && profile?.id) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from('hotel_memberships')
      .select('*')
      .eq('user_id', profile.id)
      .eq('active', true)

    if (membershipError) {
      console.error('membership load error', membershipError)
      throw new Error('Impossibile caricare le strutture abilitate')
    }

    memberships = membershipRows || []
  }

  const user = mapProfile(profile, memberships)

  if (!user.hotels.includes(hotelId)) {
    await supabase.auth.signOut()
    throw new Error('Utente non abilitato per questa struttura')
  }

  return user
}

export async function logoutPinSession() {
  if (!supabase) return

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('logout error', error)
  }
}

export async function restorePinSession() {
  if (!supabase) return null

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.user) {
    return null
  }

  const userId = session.user.id

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),

      supabase
        .from('hotel_memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true),
    ])

  if (profileError || membershipError || !profile) {
    console.error(
      'restore session error',
      profileError || membershipError,
    )

    await supabase.auth.signOut()
    return null
  }

  if (profile.active === false) {
    await supabase.auth.signOut()
    return null
  }

  return mapProfile(profile, memberships || [])
}

io
