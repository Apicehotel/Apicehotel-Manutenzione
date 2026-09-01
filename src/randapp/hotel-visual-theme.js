const HOTEL_VISUAL = Object.freeze({
  hotelgio: { accent: '#b08a24', accentStrong: '#8d6b0d', darkAccent: '#e3bd57', darkStrong: '#bd9228' },
  chocohotel: { accent: '#9b5d36', accentStrong: '#744025', darkAccent: '#d69a72', darkStrong: '#ad6c44' },
  brigantino: { accent: '#2677b8', accentStrong: '#14588f', darkAccent: '#66b8f2', darkStrong: '#3194d8' },
})

const KEYS = ['--rs-accent', '--rs-accent-strong']

export function applyHotelVisualTheme(hotelId) {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  const palette = HOTEL_VISUAL[hotelId]
  root.dataset.hotelTheme = palette ? hotelId : 'default'

  const apply = () => {
    if (!palette) {
      KEYS.forEach((key) => root.style.removeProperty(key))
      return
    }
    const dark = root.dataset.theme === 'dark'
    root.style.setProperty('--rs-accent', dark ? palette.darkAccent : palette.accent)
    root.style.setProperty('--rs-accent-strong', dark ? palette.darkStrong : palette.accentStrong)
  }

  apply()
  const onTheme = () => apply()
  window.addEventListener('apice-theme-changed', onTheme)
  return () => {
    window.removeEventListener('apice-theme-changed', onTheme)
    delete root.dataset.hotelTheme
    KEYS.forEach((key) => root.style.removeProperty(key))
  }
}

export { HOTEL_VISUAL }
