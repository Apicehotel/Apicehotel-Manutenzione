// Migliorie progressive per il dettaglio segnalazione mobile.
// Il componente React esistente mantiene tutta la logica (stato, upload e salvataggio).
// Qui teniamo aperte le due scelte Fotocamera/Galleria così restano due controlli
// direttamente utilizzabili, come nel layout approvato, senza duplicare la logica dati.

const MOBILE_DETAIL_QUERY = '(max-width: 900px), (hover: none) and (pointer: coarse)'

function isMobileDetail() {
  return typeof window !== 'undefined' && window.matchMedia?.(MOBILE_DETAIL_QUERY).matches
}

function ensurePhotoChoicesOpen(root = document) {
  if (!isMobileDetail()) return
  const sheets = root.querySelectorAll?.('.sheet-overlay > .sheet') || []
  sheets.forEach((sheet) => {
    const trigger = sheet.querySelector('.completion-fields .photo-picker-trigger')
    const options = sheet.querySelector('.completion-fields .photo-picker-options')
    if (trigger && !options && trigger.getAttribute('aria-expanded') !== 'true') {
      // Apre soltanto il pannello delle opzioni; non apre direttamente il file picker.
      // In questo modo Fotocamera e Galleria diventano due veri target separati.
      trigger.click()
    }
  })
}

function scheduleEnsure() {
  requestAnimationFrame(() => ensurePhotoChoicesOpen(document))
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnsure, { once: true })
  } else {
    scheduleEnsure()
  }

  const observer = new MutationObserver(() => scheduleEnsure())
  observer.observe(document.documentElement, { childList: true, subtree: true })

  window.matchMedia?.(MOBILE_DETAIL_QUERY).addEventListener?.('change', scheduleEnsure)
}
