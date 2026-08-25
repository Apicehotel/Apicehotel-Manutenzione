export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green', card: '/logos/card-hotelgio.png' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco', card: '/logos/card-chocohotel.png' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue', card: '/logos/card-brigantino.png' },
]

// Matrice ruoli approvata: i quattro ruoli base seguono il modello Hotel Giò,
// i ruoli specializzati Multi Hotel restano separati. "Responsabile" è rimosso.
// "Capo Governante" ha gli stessi permessi operativi di Governante e in più
// riceve le notifiche Housekeeping della propria struttura.
export const ROLES = ['admin', 'Supremo', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'manutentore', 'Tecnico esterno', 'Governante', 'Capo Governante', 'Reception', 'Isola dei Golosi', 'Ristorante Wine/Jazz', 'Colazione Jazz']

export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],
  Supremo: ['create', 'read_all_departments', 'read_own_hotel'],
  Direzione: ['create', 'assign', 'complete', 'read_all_departments'],
  manutentore: ['create', 'take_charge', 'complete', 'read_all_departments'],
  Governante: ['create', 'read_own_hotel'],
  'Capo Governante': ['create', 'read_own_hotel', 'housekeeping_notifications'],
  Reception: ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'read_own_hotel'],
  'Direttore Centro Congressi': ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'planning_sale'],
  'Portiere Notturno': ['create', 'assign', 'complete', 'take_charge', 'read_all_departments', 'read_own_hotel'],
  'Tecnico esterno': ['take_charge', 'complete', 'read_own_hotel'],
  'Isola dei Golosi': ['create', 'read_own_hotel'],
  'Ristorante Wine/Jazz': ['create', 'read_own_hotel'],
  'Colazione Jazz': ['create', 'read_own_hotel'],
}

export const USERS = []

export const WHATSAPP = Object.freeze({
  enabled: true,
  destinations: Object.freeze({
    hotelgio: Object.freeze({ phone: '0759978247', receivesIssues: true }),
    chocohotel: null,
    brigantino: null,
  }),
})

export const TWILIO = Object.freeze({ enabled: false, inboundWebhook: null, automaticMessages: false })
