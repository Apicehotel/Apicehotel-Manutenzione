export function registerPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      await registration.update()
    } catch (error) {
      console.error('Registrazione PWA non riuscita', error)
    }
  })
}
