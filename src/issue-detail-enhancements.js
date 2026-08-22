// Sul dettaglio segnalazione vogliamo un solo tasto Fotocamera.
// Al tap deve comparire direttamente il menu nativo del dispositivo
// (Libreria foto / Scatta foto / Scegli file), senza mostrare un secondo
// pannello interno dell'app.

const MOBILE_DETAIL_QUERY = '(max-width: 900px), (hover: none) and (pointer: coarse)'

function isMobileDetail() {
  return typeof window !== 'undefined' && window.matchMedia?.(MOBILE_DETAIL_QUERY).matches
}

function prepareHiddenNativePicker(root = document) {
  if (!isMobileDetail()) return
  const sheets = root.querySelectorAll?.('.sheet-overlay > .sheet') || []
  sheets.forEach((sheet) => {
    const trigger = sheet.querySelector('.completion-fields .photo-picker-trigger')
    const options = sheet.querySelector('.completion-fields .photo-picker-options')
    if (trigger && !options && trigger.getAttribute('aria-expanded') !== 'true') {
      // Prepara gli input React reali in DOM. Il pannello resta invisibile via CSS.
      trigger.click()
    }
  })
}

function schedulePrepare() {
  requestAnimationFrame(() => prepareHiddenNativePicker(document))
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.documentElement.classList.add('issue-photo-native-menu')

  // Intercetta il tap sul solo tasto Fotocamera e apre direttamente l'input
  // senza `capture`: su iOS/Android questo mostra il menu nativo con le scelte
  // disponibili (fotocamera, libreria/galleria, file).
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('.completion-fields .photo-picker-trigger')
    if (!trigger || !isMobileDetail()) return

    const sheet = trigger.closest('.sheet')
    const galleryInput = sheet?.querySelector('.completion-fields .photo-picker-options input[type="file"]:not([capture])')
    if (!galleryInput) return // primo passaggio: lascia a React il tempo di preparare gli input

    event.preventDefault()
    event.stopPropagation()
    galleryInput.click()
  }, true)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePrepare, { once: true })
  } else {
    schedulePrepare()
  }

  const observer = new MutationObserver(schedulePrepare)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.matchMedia?.(MOBILE_DETAIL_QUERY).addEventListener?.('change', schedulePrepare)
}
