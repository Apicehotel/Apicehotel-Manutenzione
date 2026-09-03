export const RANDUI_IDENTITY_VERSION = 1

const IDENTITIES = Object.freeze({
  hotelgio: Object.freeze({ id: 'hotelgio', label: 'Hotel Giò', shortLabel: 'Giò', accent: '#6654c7', accentStrong: '#4f3eaa' }),
  chocohotel: Object.freeze({ id: 'chocohotel', label: 'ChocoHotel', shortLabel: 'Choco', accent: '#925b32', accentStrong: '#704224' }),
  brigantino: Object.freeze({ id: 'brigantino', label: 'Hotel Il Brigantino', shortLabel: 'Brigantino', accent: '#126b87', accentStrong: '#0b536b' }),
})

export const RANDUI_HOTEL_IDENTITIES = IDENTITIES

export function hotelIdentity(hotelId) {
  return IDENTITIES[hotelId] || null
}

export function applyHotelIdentity(hotelId) {
  if (typeof document === 'undefined') return
  const identity = hotelIdentity(hotelId)
  if (!identity) {
    delete document.documentElement.dataset.hotel
    delete document.documentElement.dataset.hotelIdentityVersion
    return
  }
  document.documentElement.dataset.hotel = identity.id
  document.documentElement.dataset.hotelIdentityVersion = String(RANDUI_IDENTITY_VERSION)
}
