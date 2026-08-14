export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green', card: '/logos/card-hotelgio.png' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco', card: '/logos/card-chocohotel.png' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue', card: '/logos/card-brigantino.png' },
]

export const ROLES = ['admin', 'Responsabile', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'manutentore', 'Tecnico esterno', 'segnalatore']

export const DEPARTMENTS = [
  'Governante',
  'Reception',
  'Isola dei Golosi',
  'Ristorante Wine',
  'Ristorante Jazz',
  'Colazione Jazz',
]

export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'complete', 'planning_sale'],
  Responsabile: ['create', 'assign', 'complete'],
  Direzione: ['create', 'assign', 'complete', 'read_all_departments'],
  'Direttore Centro Congressi': ['create', 'assign', 'complete', 'planning_sale'],
  'Portiere Notturno': ['create', 'read_own_hotel'],
  manutentore: ['create', 'take_charge', 'complete'],
  'Tecnico esterno': ['take_charge', 'complete', 'read_own_hotel'],
  segnalatore: ['create', 'read_own_hotel'],
}

// Dati demo locali: saranno sostituiti da profili e membership Supabase.
export const USERS = [
  { id: 'alberto', name: 'Alberto', role: 'admin', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
  { id: 'paolo', name: 'Paolo', role: 'Responsabile', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
  { id: 'domenico', name: 'Domenico', role: 'manutentore', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
  { id: 'reception-gio', name: 'Reception', role: 'segnalatore', department: 'Reception', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
  { id: 'governante-choco', name: 'Governante Choco', role: 'segnalatore', department: 'Governante', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
]

export const TWILIO = Object.freeze({
  enabled: false,
  inboundWebhook: null,
  automaticMessages: false,
})
