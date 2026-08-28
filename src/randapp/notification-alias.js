export const NOTIFICATION_HOTEL_PREFIX = Object.freeze({
  hotelgio: 'GIO',
  chocohotel: 'CHO',
  brigantino: 'BRI',
})

export const NOTIFICATION_CHANNEL_CODE = Object.freeze({
  urgent: 'AV',
  reminders: 'PR',
  assignments: 'IP',
  housekeeping: 'HK',
})

const HOTEL_ID_BY_PREFIX = Object.freeze(Object.fromEntries(Object.entries(NOTIFICATION_HOTEL_PREFIX).map(([id,prefix])=>[prefix,id])))
const CHANNEL_ID_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(NOTIFICATION_CHANNEL_CODE).map(([id,code])=>[code,id])))

export function normalizeNotificationCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6)
}

export function isValidNotificationCode(value) {
  return /^\d{6}$/.test(String(value || ''))
}

export function buildNotificationAlias(hotelId, channelId, code) {
  const hotel = NOTIFICATION_HOTEL_PREFIX[hotelId]
  const channel = NOTIFICATION_CHANNEL_CODE[channelId]
  if (!hotel || !channel || !isValidNotificationCode(code)) return ''
  return `${hotel}-${channel}-${code}`
}

export function parseNotificationAlias(value) {
  const alias=String(value||'').trim().toUpperCase()
  const match=alias.match(/^([A-Z]{3})-(AV|PR|IP|HK)-(\d{6})$/)
  if(!match) return null
  const hotelId=HOTEL_ID_BY_PREFIX[match[1]]
  const channelId=CHANNEL_ID_BY_CODE[match[2]]
  if(!hotelId||!channelId) return null
  return { alias, hotelId, channelId, code:match[3] }
}

export function buildNotificationShortUrl(alias, origin) {
  const parsed=parseNotificationAlias(alias)
  if(!parsed) return ''
  const base=String(origin || (typeof window!=='undefined' ? window.location.origin : '')).replace(/\/$/,'')
  return base ? `${base}/n/${encodeURIComponent(parsed.alias)}` : `/n/${encodeURIComponent(parsed.alias)}`
}
