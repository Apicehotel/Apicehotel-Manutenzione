// Modalità dimensione interfaccia — riusa la persistenza già presente nell'app originale.
const KEY = 'apicehotel.ui-size.v1'
const VALUES = ['small', 'normal', 'large']

export const UI_SIZES = [['small', 'Piccolo'], ['normal', 'Normale'], ['large', 'Grande']]

export const loadUiSize = () => {
  try { const saved = localStorage.getItem(KEY); return VALUES.includes(saved) ? saved : 'normal' }
  catch { return 'normal' }
}

export const applyUiSize = (value) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.uiSize = VALUES.includes(value) ? value : 'normal'
}

const persist = (value) => { try { localStorage.setItem(KEY, value) } catch { /* la sessione resta usabile senza storage */ } }

export const setUiSize = (value) => {
  const next = VALUES.includes(value) ? value : 'normal'
  applyUiSize(next)
  persist(next)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('apice-ui-size-changed', { detail: { value: next } }))
}

export const initUiSize = () => applyUiSize(loadUiSize())
