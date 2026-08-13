export const HOTELS = [
  { id: 'hotelgio', short: 'Giò', name: 'Hotel Giò', mark: 'HG', tone: 'green' },
  { id: 'chocohotel', short: 'Choco', name: 'ChocoHotel', mark: 'CH', tone: 'choco' },
  { id: 'brigantino', short: 'Brigantino', name: 'Hotel Il Brigantino', mark: 'IB', tone: 'blue' },
]

export const ROLES = ['admin', 'responsabile', 'manutentore', 'segnalatore']

export const DEPARTMENTS = [
  'Governante',
  'Reception',
  'Isola dei Golosi',
  'Ristorante Wine',
  'Ristorante Jazz',
  'Colazione Jazz',
]

export const ROLE_PERMISSIONS = {
  admin: ['manage_users', 'manage_all_hotels', 'create', 'assign', 'complete'],
  responsabile: ['create', 'assign', 'complete'],
  manutentore: ['create', 'take_charge', 'complete'],
  segnalatore: ['create', 'read_own_hotel'],
}

// Dati demo locali: saranno sostituiti da profili e membership Supabase.
export const USERS = [
  { id: 'alberto', name: 'Alberto', role: 'admin', pin: '0000', hotels: ['hotelgio', 'chocohotel', 'brigantino'] },
  { id: 'paolo', name: 'Paolo', role: 'responsabile', pin: '0000', hotels: ['hotelgio', 'chocohotel'] },
  { id: 'domenico', name: 'Domenico', role: 'manutentore', pin: '0000', hotels: ['hotelgio'] },
  { id: 'reception-gio', name: 'Reception', role: 'segnalatore', department: 'Reception', pin: '0000', hotels: ['hotelgio'] },
  { id: 'governante-choco', name: 'Governante Choco', role: 'segnalatore', department: 'Governante', pin: '0000', hotels: ['chocohotel'] },
]

export const TWILIO = Object.freeze({
  enabled: false,
  inboundWebhook: null,
  automaticMessages: false,
})
