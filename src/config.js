export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green', card: '/logos/card-hotelgio.png' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco', card: '/logos/card-chocohotel.png' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue', card: '/logos/card-brigantino.png' },
]

// Matrice ruoli approvata: i quattro ruoli base seguono il modello Hotel Giò,
// i ruoli specializzati Multi Hotel restano separati. "Responsabile" è rimosso.
// "Supremo" è una Direzione di sola lettura sull'operatività manutentiva.
export const ROLES = ['admin', 'Supremo', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'manutentore', 'Tecnico esterno', 'Governante', 'Reception', 'Isola dei Golosi', 'Ristorante Wine/Jazz', 'Colazione Jazz']

export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],

  // Supremo vede l'intera operatività ma non può creare, assegnare,
  // prendere in carico o completare manutenzioni.
  Supremo: ['read_all_departments', 'read_own_hotel'],

  // Ruoli base allineati al comportamento Hotel Giò approvato.
  Direzione: ['create', 'assign', 'complete', 'read_all_departments'],
  manutentore: ['create', 'take_charge', 'complete', 'read_all_departments'],
  Governante: ['create', 'read_own_hotel'],
  Reception: ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'read_own_hotel'],

  // Ruoli specializzati Multi Hotel mantenuti come deciso.
  'Direttore Centro Congressi': ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],
  'Portiere Notturno': ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'read_own_hotel'],
  'Tecnico esterno': ['take_charge', 'complete', 'read_own_hotel'],
  'Isola dei Golosi': ['create', 'read_own_hotel'],
  'Ristorante Wine/Jazz': ['create', 'read_own_hotel'],
  'Colazione Jazz': ['create', 'read_own_hotel'],
}

// Nessun utente o PIN demo viene incluso nel bundle frontend.
export const USERS = []

export const TWILIO = Object.freeze({ enabled: false, inboundWebhook: null, automaticMessages: false })
