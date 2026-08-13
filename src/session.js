const KEY = 'apicehotel.session.v1'

export function loadSession() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY))
    return value?.hotelId && value?.userId ? value : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
