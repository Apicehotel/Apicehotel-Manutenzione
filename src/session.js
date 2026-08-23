const KEY = 'apicehotel.session.v1'
const EVENT = 'apice-session-changed'

function announce(session) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: session || null }))
}

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
  announce(session)
}

export function clearSession() {
  localStorage.removeItem(KEY)
  announce(null)
}
