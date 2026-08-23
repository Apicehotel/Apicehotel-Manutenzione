export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green', card: '/logos/card-hotelgio.png' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco', card: '/logos/card-chocohotel.png' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue', card: '/logos/card-brigantino.png' },
]

// Ruoli Multi Hotel. "Responsabile" è stato rimosso: le responsabilità di
// struttura confluiscono nella Direzione, come nel modello operativo Hotel Giò.
// "Supremo" duplica la visibilità della Direzione ma resta rigorosamente
// in sola lettura sulle manutenzioni: niente crea/assegna/vado/fatto.
export const ROLES = ['admin', 'Supremo', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'manutentore', 'Tecnico esterno', 'segnalatore']

export const DEPARTMENTS = ['Governante', 'Reception', 'Isola dei Golosi', 'Ristorante Wine', 'Ristorante Jazz', 'Colazione Jazz']

// Base permessi allineata al comportamento effettivo di Hotel Giò:
// - Direzione e Reception sono ruoli di gestione e vedono/gestiscono l'operatività.
// - Supremo ha la stessa ampiezza di lettura della Direzione ma nessun permesso
//   di mutazione manutentiva: non può creare, assegnare, prendere in carico o completare.
// - Manutentore vede il lavoro operativo, lo prende in carico e lo completa.
// - Governante resta un reparto segnalatore (via ruolo tecnico "segnalatore").
// - Portiere Notturno mantiene il nome ma usa la stessa base operativa Reception.
export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'take_charge', 'complete', 'read_all_departments', 'read_own_hotel', 'planning_sale'],
  Supremo: ['read_all_departments', 'read_own_hotel'],
  Direzione: ['create', 'assign', 'complete', 'read_all_departments', 'read_own_hotel'],
  'Direttore Centro Congressi': ['create', 'assign', 'complete', 'planning_sale'],
  'Portiere Notturno': ['create', 'assign', 'take_charge', 'complete', 'read_all_departments', 'read_own_hotel'],
  manutentore: ['create', 'take_charge', 'complete', 'read_all_departments', 'read_own_hotel'],
  'Tecnico esterno': ['take_charge', 'complete', 'read_own_hotel'],
  segnalatore: ['create', 'read_own_hotel'],
}

// I reparti Governante/Reception/Isola/Ristorante/Colazione sono assegnati agli
// utenti separatamente dal ruolo. Reception riceve la base operativa Hotel Giò;
// gli altri reparti mantengono il profilo segnalatore scelto per Multi Hotel.
export const DEPARTMENT_PERMISSION_OVERRIDES = {
  Reception: ['create', 'assign', 'take_charge', 'complete', 'read_all_departments', 'read_own_hotel'],
}

export function permissionsForUser(user) {
  if (!user) return []
  const rolePermissions = ROLE_PERMISSIONS[user.role] || []
  // Supremo deve restare read-only anche se per errore gli venisse associato
  // un reparto con privilegi operativi (es. Reception).
  const departmentPermissions = user.role === 'Supremo' ? [] : (DEPARTMENT_PERMISSION_OVERRIDES[user.department] || [])
  return [...new Set([...rolePermissions, ...departmentPermissions])]
}

// Nessun utente o PIN demo viene incluso nel bundle frontend.
export const USERS = []

export const TWILIO = Object.freeze({ enabled: false, inboundWebhook: null, automaticMessages: false })
