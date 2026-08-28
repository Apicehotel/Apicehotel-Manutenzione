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
