const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(value) {
  const text = String(value || '')
  if (!ISO_DATE_RE.test(text)) return false
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function previousIsoDate(value) {
  if (!isValidIsoDate(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function validateBookingDates({ dateFrom, dateTo, prepDate } = {}) {
  if (!isValidIsoDate(dateFrom) || !isValidIsoDate(dateTo) || !isValidIsoDate(prepDate)) {
    return Object.freeze({ valid: false, code: 'INVALID_DATE', message: 'Inserisci date valide per evento e preparazione.' })
  }
  if (dateTo < dateFrom) {
    return Object.freeze({ valid: false, code: 'EVENT_RANGE', message: 'La data fine evento non può precedere la data di inizio.' })
  }
  if (prepDate > dateFrom) {
    return Object.freeze({ valid: false, code: 'PREP_AFTER_EVENT', message: 'La preparazione deve essere nello stesso giorno dell’inizio evento o prima.' })
  }
  return Object.freeze({ valid: true, code: 'OK', message: '' })
}

export function freshAvailabilityDecision(result, status) {
  if (result?.ok === true) {
    return status === 'free'
      ? Object.freeze({ allowed: true, code: 'FREE' })
      : Object.freeze({ allowed: false, code: 'ROOM_NO_LONGER_FREE', message: 'La sala non è più disponibile per il periodo selezionato. Aggiorna la scelta.' })
  }
  if (result?.offline === true) return Object.freeze({ allowed: true, code: 'OFFLINE_QUEUE' })
  return Object.freeze({ allowed: false, code: 'AVAILABILITY_CHECK_FAILED', message: 'Impossibile verificare la disponibilità aggiornata della sala. Riprova.' })
}
