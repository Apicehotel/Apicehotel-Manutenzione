const MOBILE_QUERY = '(max-width: 959px)'
const ROOT_ID = 'randapp-liquid-dock-prototype'

// Tabler Icons (MIT) — inline paths keep the dock dependency-free while
// using the selected RandApp icon language.
const TABLER = {
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  tool: '<path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5"/>',
  calendar: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"/><path d="M16 3l0 4"/><path d="M8 3l0 4"/><path d="M4 11l16 0"/>',
  package: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>',
  sparkles: '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 6 6"/>',
}

function icon(name) {
  return `<svg class="rs-liquid-dock__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TABLER[name] || TABLER.sparkles}</svg>`
}

function clickTarget(selector) {
  const target = document.querySelector(selector)
  if (target instanceof HTMLElement) {
    target.click()
    return true
  }
  return false
}

function dispatchRandAI(source) {
  window.dispatchEvent(new CustomEvent('randai-toggle', { detail: { mode: 'open', source } }))
}

function createDock() {
  const dock = document.createElement('section')
  dock.id = ROOT_ID
  dock.className = 'rs-liquid-dock lg-on-light'
  dock.setAttribute('aria-label', 'Navigazione e azioni rapide RandApp')
  dock.innerHTML = `
    <div class="rs-liquid-dock__backdrop" data-dock-close aria-hidden="true"></div>
    <div class="rs-liquid-dock__sheet lg-surface" data-dock-sheet aria-hidden="true" role="dialog" aria-modal="false" aria-label="Azioni rapide">
      <button type="button" class="rs-liquid-dock__handle" data-dock-toggle aria-expanded="false" aria-label="Chiudi azioni rapide"><span></span></button>
      <div class="rs-liquid-dock__title"><b>Azioni rapide</b><small>Scorri verso il basso per chiudere</small></div>
      <div class="rs-liquid-dock__actions">
        <button type="button" data-dock-action="issue"><i>${icon('plus')}</i><span><b>Nuova segnalazione</b><small>Apri un nuovo problema</small></span></button>
        <button type="button" data-dock-action="intervention"><i>${icon('tool')}</i><span><b>Nuovo intervento</b><small>Pianifica il lavoro</small></span></button>
        <button type="button" data-dock-action="planning"><i>${icon('calendar')}</i><span><b>Planning</b><small>Lavori e sale</small></span></button>
        <button type="button" data-dock-action="inventory"><i>${icon('package')}</i><span><b>Magazzino</b><small>Apri scorte e ricambi</small></span></button>
      </div>
      <button type="button" class="rs-liquid-dock__randai-card" data-dock-action="randai">
        <i>${icon('sparkles')}</i><span><b>RandAI</b><small>Assistente operativo contestuale</small></span><strong>›</strong>
      </button>
    </div>

    <div class="rs-liquid-dock__surface lg-surface">
      <div class="rs-liquid-dock__bridge" aria-hidden="true"></div>
      <div class="rs-liquid-dock__quickbar">
        <button type="button" class="rs-liquid-dock__quick rs-liquid-dock__quick--create" data-dock-action="create" aria-label="Nuovo inserimento">
          ${icon('plus')}<small>Nuovo</small>
        </button>
        <button type="button" class="rs-liquid-dock__pull" data-dock-toggle aria-expanded="false" aria-label="Apri azioni rapide"><span></span></button>
        <button type="button" class="rs-liquid-dock__quick rs-liquid-dock__quick--ai" data-dock-action="randai" aria-label="Apri RandAI">
          ${icon('sparkles')}<small>RandAI</small>
        </button>
      </div>
      <div class="rs-liquid-dock__navslot" data-dock-navslot></div>
    </div>
  `
  return dock
}

function setOpen(dock, open) {
  dock.classList.toggle('is-open', open)
  dock.querySelectorAll('[data-dock-toggle]').forEach((el) => el.setAttribute('aria-expanded', open ? 'true' : 'false'))
  dock.querySelector('[data-dock-sheet]')?.setAttribute('aria-hidden', open ? 'false' : 'true')
  dock.querySelector('[data-dock-sheet]')?.setAttribute('aria-modal', open ? 'true' : 'false')
}

function installGestures(dock) {
  let pointerId = null
  let startY = 0
  let startX = 0
  let startAt = 0

  const onDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerId = event.pointerId
    startY = event.clientY
    startX = event.clientX
    startAt = performance.now()
  }
  const onUp = (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return
    const dy = event.clientY - startY
    const dx = event.clientX - startX
    const duration = performance.now() - startAt
    pointerId = null
    if (duration > 700 || Math.abs(dy) < 42 || Math.abs(dy) < Math.abs(dx) * 1.2) return
    setOpen(dock, dy < 0)
  }
  const onCancel = () => { pointerId = null }

  dock.addEventListener('pointerdown', onDown, { passive: true })
  dock.addEventListener('pointerup', onUp, { passive: true })
  dock.addEventListener('pointercancel', onCancel, { passive: true })

  const onKey = (event) => {
    if (event.key === 'Escape' && dock.classList.contains('is-open')) setOpen(dock, false)
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}

function installActions(dock) {
  dock.addEventListener('click', (event) => {
    if (event.target.closest('[data-dock-close]')) {
      setOpen(dock, false)
      return
    }
    const toggle = event.target.closest('[data-dock-toggle]')
    if (toggle) {
      setOpen(dock, !dock.classList.contains('is-open'))
      return
    }
    const action = event.target.closest('[data-dock-action]')?.dataset.dockAction
    if (!action) return
    if (action === 'create') {
      clickTarget('[data-testid="fab-new"]')
      return
    }
    if (action === 'randai') {
      setOpen(dock, false)
      dispatchRandAI('liquid-dock')
      return
    }
    if (action === 'issue') {
      setOpen(dock, false)
      if (!clickTarget('[data-testid="fab-new"]')) return
      window.setTimeout(() => clickTarget('[data-testid="insert-issue"]'), 80)
      return
    }
    if (action === 'intervention') {
      setOpen(dock, false)
      if (!clickTarget('[data-testid="fab-new"]')) return
      window.setTimeout(() => clickTarget('[data-testid="insert-intervention"]'), 80)
      return
    }
    if (action === 'planning') {
      setOpen(dock, false)
      clickTarget('[data-testid="nav-planning-work"]') || clickTarget('[data-testid="nav-planning"]')
      return
    }
    if (action === 'inventory') {
      setOpen(dock, false)
      clickTarget('[data-testid="nav-inventory"]')
    }
  })
}

function restoreNav(dock) {
  const nav = dock?._ownedNav
  const anchor = dock?._navAnchor
  if (nav instanceof HTMLElement && anchor?.parentNode) anchor.parentNode.insertBefore(nav, anchor.nextSibling)
  anchor?.remove?.()
}

function mount() {
  if (!window.matchMedia(MOBILE_QUERY).matches) return
  if (document.getElementById(ROOT_ID)) return
  const nav = document.querySelector('.rs-bottomnav')
  if (!(nav instanceof HTMLElement)) return

  const anchor = document.createComment('randapp-liquid-dock-nav-anchor')
  nav.parentNode?.insertBefore(anchor, nav)

  const dock = createDock()
  nav.insertAdjacentElement('beforebegin', dock)
  dock.querySelector('[data-dock-navslot]')?.appendChild(nav)
  dock._ownedNav = nav
  dock._navAnchor = anchor

  installActions(dock)
  dock._cleanupDockGesture = installGestures(dock)
}

function unmount() {
  const dock = document.getElementById(ROOT_ID)
  if (!dock) return
  dock._cleanupDockGesture?.()
  restoreNav(dock)
  dock.remove()
}

export function installLiquidDockPrototype() {
  const tryMount = () => mount()
  tryMount()
  const observer = new MutationObserver(tryMount)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  const onResize = () => {
    if (!window.matchMedia(MOBILE_QUERY).matches) unmount()
    else mount()
  }
  const onSession = () => window.setTimeout(mount, 80)
  window.addEventListener('resize', onResize)
  window.addEventListener('apice-session-changed', onSession)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('apice-session-changed', onSession)
    unmount()
  }
}
