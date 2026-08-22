export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green', card: '/logos/card-hotelgio.png' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco', card: '/logos/card-chocohotel.png' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue', card: '/logos/card-brigantino.png' },
]

export const ROLES = ['admin', 'Responsabile', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'manutentore', 'Tecnico esterno', 'Governante', 'Reception', 'Isola dei Golosi', 'Ristorante Wine/Jazz', 'Colazione Jazz']

export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],
  Responsabile: ['create', 'assign', 'complete', 'planning_sale'],
  Direzione: ['create', 'assign', 'complete', 'read_all_departments'],
  'Direttore Centro Congressi': ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],
  'Portiere Notturno': ['create', 'read_own_hotel'],
  manutentore: ['create', 'take_charge', 'complete', 'read_all_departments'],
  'Tecnico esterno': ['take_charge', 'complete', 'read_own_hotel'],
  Governante: ['create', 'read_own_hotel'],
  Reception: ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'read_own_hotel'],
  'Isola dei Golosi': ['create', 'read_own_hotel'],
  'Ristorante Wine/Jazz': ['create', 'read_own_hotel'],
  'Colazione Jazz': ['create', 'read_own_hotel'],
}

// Nessun utente o PIN demo viene incluso nel bundle frontend.
export const USERS = []

export const TWILIO = Object.freeze({ enabled: false, inboundWebhook: null, automaticMessages: false })
