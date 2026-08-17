import { supabase } from './supabase.js'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase non configurato')
  }
}

function normalizeHotels(hotels) {
  if (!Array.isArray(hotels)) return []

  return [...new Set(
    hotels
      .map((hotel) => String(hotel || '').trim())
      .filter(Boolean)
  )]
}

function normalizePin(pin) {
  return String(pin || '')
    .replace(/\D/g, '')
    .slice(0, 4)
}

function normalizePhone(phone) {
  return String(phone || '')
    .trim()
    .replace(/[^\d]/g, '')
}

function normalizeCountryCode(value) {
  const clean = String(value || '+39')
    .trim()
    .replace(/[^\d+]/g, '')

  if (!clean) return '+39'

  return clean.startsWith('+')
    ? clean
    : `+${clean}`
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function mapAdminUser(rawUser) {
  if (!rawUser) return null

  return {
    id:
      rawUser.id ||
      rawUser.auth_user_id,

    authUserId:
      rawUser.auth_user_id ||
      rawUser.id,

    legacyId:
      rawUser.legacy_id ||
      rawUser.legacy_user_id ||
      null,

    name:
      rawUser.name ||
      rawUser.display_name ||
      '',

    role:
      rawUser.role ||
      'segnalatore',

    department:
      rawUser.department ||
      '',

    email:
      rawUser.email ||
      '',

    phone:
      rawUser.phone ||
      '',

    phoneCountryCode:
      rawUser.phone_country_code ||
      '+39',

    hotels:
      normalizeHotels(
        rawUser.hotels ||
        rawUser.hotel_ids ||
        []
      ),

    active:
      rawUser.active !== false,

    canAdmin:
      Boolean(
        rawUser.can_admin ||
        rawUser.can_access_admin ||
        rawUser.role === 'admin'
      ),

    canAccessAdmin:
      Boolean(
        rawUser.can_admin ||
        rawUser.can_access_admin ||
        rawUser.role === 'admin'
      ),

    mustChangePin:
      Boolean(
        rawUser.must_change_pin
      ),
  }
}

async function invokeAdmin(body) {
  requireSupabase()

  const { data, error } =
    await supabase.functions.invoke(
      'admin-users',
      {
        body,
      }
    )

  if (error) {
    console.error(
      'admin-users error',
      error,
      data
    )

    const status =
      error?.context?.status

    if (status === 401) {
      throw new Error(
        data?.error ||
        'Sessione scaduta. Accedi di nuovo.'
      )
    }

    if (status === 403) {
      throw new Error(
        data?.error ||
        'Permesso amministratore richiesto'
      )
    }

    if (status === 409) {
      throw new Error(
        data?.error ||
        'Esiste già un utente con questi dati'
      )
    }

    if (status === 422) {
      throw new Error(
        data?.error ||
        'Controlla i dati inseriti'
      )
    }

    throw new Error(
      data?.error ||
      'Errore nella gestione utenti'
    )
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
      'Errore nella gestione utenti'
    )
  }

  return data
}

/*
 * ELENCO UTENTI
 */

export async function fetchAdminUsers() {
  const data =
    await invokeAdmin({
      action: 'list',
    })

  const users =
    data.users ||
    data.items ||
    []

  if (!Array.isArray(users)) {
    return []
  }

  return users
    .map(mapAdminUser)
    .filter(Boolean)
}

/*
 * CREAZIONE UTENTE
 *
 * Supporta:
 * - nome
 * - ruolo
 * - reparto
 * - cellulare
 * - prefisso
 * - email
 * - PIN
 * - strutture
 * - accesso Admin
 */

export async function createAdminUser(input) {
  const name =
    String(
      input?.name || ''
    ).trim()

  const role =
    String(
      input?.role ||
      'segnalatore'
    ).trim()

  const department =
    String(
      input?.department || ''
    ).trim()

  const email =
    normalizeEmail(
      input?.email
    )

  const phone =
    normalizePhone(
      input?.phone
    )

  const phoneCountryCode =
    normalizeCountryCode(
      input?.phoneCountryCode ||
      input?.phone_country_code
    )

  const pin =
    normalizePin(
      input?.pin
    )

  const hotels =
    normalizeHotels(
      input?.hotels
    )

  const canAccessAdmin =
    Boolean(
      input?.canAccessAdmin ??
      input?.canAdmin ??
      false
    )

  if (!name) {
    throw new Error(
      'Inserisci il nome'
    )
  }

  if (pin.length !== 4) {
    throw new Error(
      'Il PIN deve contenere 4 cifre'
    )
  }

  if (!hotels.length) {
    throw new Error(
      'Seleziona almeno una struttura'
    )
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      'Email non valida'
    )
  }

  const data =
    await invokeAdmin({
      action: 'create',

      name,

      role,

      department:
        department || null,

      email:
        email || null,

      phone:
        phone || null,

      phone_country_code:
        phoneCountryCode,

      pin,

      hotels,

      can_access_admin:
        canAccessAdmin,
    })

  return mapAdminUser(
    data.user
  )
}

/*
 * MODIFICA UTENTE
 *
 * Permette di cambiare anche
 * email e cellulare degli utenti
 * già esistenti.
 */

export async function updateAdminUser(
  userOrId,
  changes = {}
) {
  const authUserId =
    typeof userOrId === 'object'
      ? (
          userOrId.authUserId ||
          userOrId.auth_user_id ||
          userOrId.id
        )
      : userOrId

  if (!authUserId) {
    throw new Error(
      'Utente non valido'
    )
  }

  const payload = {
    action: 'update',
    auth_user_id:
      authUserId,
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'name'
    )
  ) {
    payload.name =
      String(
        changes.name || ''
      ).trim()
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'role'
    )
  ) {
    payload.role =
      String(
        changes.role || ''
      ).trim()
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'department'
    )
  ) {
    payload.department =
      String(
        changes.department || ''
      ).trim() || null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'email'
    )
  ) {
    const email =
      normalizeEmail(
        changes.email
      )

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      throw new Error(
        'Email non valida'
      )
    }

    payload.email =
      email || null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'phone'
    )
  ) {
    payload.phone =
      normalizePhone(
        changes.phone
      ) || null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'phoneCountryCode'
    ) ||
    Object.prototype.hasOwnProperty.call(
      changes,
      'phone_country_code'
    )
  ) {
    payload.phone_country_code =
      normalizeCountryCode(
        changes.phoneCountryCode ||
        changes.phone_country_code
      )
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'hotels'
    )
  ) {
    const hotels =
      normalizeHotels(
        changes.hotels
      )

    if (!hotels.length) {
      throw new Error(
        'Ogni utente deve avere almeno una struttura'
      )
    }

    payload.hotels =
      hotels
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'canAccessAdmin'
    ) ||
    Object.prototype.hasOwnProperty.call(
      changes,
      'canAdmin'
    ) ||
    Object.prototype.hasOwnProperty.call(
      changes,
      'can_access_admin'
    )
  ) {
    payload.can_access_admin =
      Boolean(
        changes.canAccessAdmin ??
        changes.canAdmin ??
        changes.can_access_admin
      )
  }

  const data =
    await invokeAdmin(
      payload
    )

  return data.user
    ? mapAdminUser(data.user)
    : true
}

/*
 * CAMBIO PIN DA ADMIN
 */

export async function setAdminUserPin(
  userOrId,
  pin,
  mustChangePin = false
) {
  const authUserId =
    typeof userOrId === 'object'
      ? (
          userOrId.authUserId ||
          userOrId.auth_user_id ||
          userOrId.id
        )
      : userOrId

  const cleanPin =
    normalizePin(pin)

  if (!authUserId) {
    throw new Error(
      'Utente non valido'
    )
  }

  if (cleanPin.length !== 4) {
    throw new Error(
      'Il PIN deve contenere 4 cifre'
    )
  }

  await invokeAdmin({
    action: 'set_pin',

    auth_user_id:
      authUserId,

    pin:
      cleanPin,

    must_change_pin:
      Boolean(
        mustChangePin
      ),
  })

  return true
}

/*
 * ATTIVA / DISATTIVA UTENTE
 */

export async function setAdminUserActive(
  userOrId,
  active,
  reason = null
) {
  const authUserId =
    typeof userOrId === 'object'
      ? (
          userOrId.authUserId ||
          userOrId.auth_user_id ||
          userOrId.id
        )
      : userOrId

  if (!authUserId) {
    throw new Error(
      'Utente non valido'
    )
  }

  await invokeAdmin({
    action: 'set_active',

    auth_user_id:
      authUserId,

    active:
      Boolean(active),

    reason:
      reason || null,
  })

  return true
}

/*
 * Alias mantenuti per evitare problemi
 * con eventuali vecchi import.
 */

export const createRemoteUser =
  createAdminUser

export const updateRemoteUser =
  updateAdminUser

export const setRemoteUserPin =
  setAdminUserPin

export const setRemoteUserActive =
  setAdminUserActive
