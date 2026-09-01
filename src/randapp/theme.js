import { loadSession } from '../session.js'

// Tema RandApp: Sistema | Chiaro | Scuro.
// La scelta utente resta in localStorage; a livello DOM impostiamo SEMPRE il tema RISOLTO
// (light|dark) su <html data-theme>. La base di lavoro predefinita è Chiaro: Sistema e Scuro
// restano scelte esplicite dell'utente.
const KEY = 'apicehotel.theme.v1'
const CHOICES = ['system', 'light', 'dark']
export const THEMES = [['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']]
const SESSION_EVENT = 'apice-session-changed'

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

export const loadThemeChoice = () => {
  try { const saved = localStorage.getItem(KEY); return CHOICES.includes(saved) ? saved : 'light' }
  catch { return 'light' }
}

export const resolveTheme = (choice) => (choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice)

const setThemeColorMeta = (resolved) => {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f7fa' : '#060a13')
}

export const applyHotelAccent = () => {
  if (typeof document === 'undefined') return
  const hotelId = loadSession()?.hotelId || ''
  if (hotelId) document.documentElement.dataset.hotel = hotelId
  else delete document.documentElement.dataset.hotel
}

export const applyTheme = (choice) => {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(choice)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themeChoice = CHOICES.includes(choice) ? choice : 'light'
  setThemeColorMeta(resolved)
  applyHotelAccent()
}

const persist = (choice) => { try { localStorage.setItem(KEY, choice) } catch { /* sessione usabile senza storage */ } }

export const setThemeChoice = (choice) => {
  const next = CHOICES.includes(choice) ? choice : 'light'
  applyTheme(next)
  persist(next)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('apice-theme-changed', { detail: { choice: next, resolved: resolveTheme(next) } }))
}

let mediaBound = false
let sessionBound = false
export const initTheme = () => {
  applyTheme(loadThemeChoice())
  if (!mediaBound && typeof window !== 'undefined' && window.matchMedia) {
    mediaBound = true
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (loadThemeChoice() === 'system') applyTheme('system')
    })
  }
  if (!sessionBound && typeof window !== 'undefined') {
    sessionBound = true
    window.addEventListener(SESSION_EVENT, applyHotelAccent)
  }
}
