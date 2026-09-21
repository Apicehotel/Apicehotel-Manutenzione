export function registerPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      await registration.update()
    } catch (error) {
      // Caught registration races (preview CDN/SW propagate) are non-fatal for the shell.
      console.warn('Registrazione PWA non riuscita', error)
    }
  })
}
