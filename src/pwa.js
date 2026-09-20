export function registerPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js?v=14', { updateViaCache: 'none' })
      await registration.update()
    } catch {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        await registration.update()
      } catch (error) {
        console.warn('Registrazione PWA non riuscita; continuo in modalità web', error)
      }
    }
  })
}
