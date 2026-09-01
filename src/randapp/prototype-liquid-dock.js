const MOBILE_QUERY = '(max-width: 959px)'
const ROOT_ID = 'randapp-liquid-dock-prototype'

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
  dock.className = 'rs-liquid-dock'
  dock.setAttribute('aria-label', 'Azioni rapide RandApp')
  dock.innerHTML = `
    <div class="rs-liquid-dock__sheet" data-dock-sheet aria-hidden="true">
      <button type="button" class="rs-liquid-dock__handle" data-dock-toggle aria-expanded="false" aria-label="Apri azioni rapide">
        <span></span>
      </button>
      <div class="rs-liquid-dock__title">
        <span><b>Azioni rapide</b><small>Scorri verso il basso per chiudere</small></span>
      </div>
      <div class="rs-liquid-dock__actions">
        <button type="button" data-dock-action="issue"><i>＋</i><span><b>Segnalazione</b><small>Nuovo problema</small></span></button>
        <button type="button" data-dock-action="intervention"><i>⌁</i><span><b>Intervento</b><small>Pianifica lavoro</small></span></button>
        <button type="button" data-dock-action="planning"><i>□</i><span><b>Planning</b><small>Lavori e sale</small></span></button>
        <button type="button" data-dock-action="randai"><i>✦</i><span><b>RandAI</b><small>Assistente contestuale</small></span></button>
      </div>
    </div>
    <div class="rs-liquid-dock__crest" data-dock-crest>
      <button type="button" class="rs-liquid-dock__command rs-liquid-dock__command--create" data-dock-action="create" aria-label="Nuovo inserimento">
        <span>＋</span><small>Nuovo</small>
      </button>
      <button type="button" class="rs-liquid-dock__grip" data-dock-toggle aria-expanded="false" aria-label="Apri azioni rapide"><span></span></button>
      <button type="button" class="rs-liquid-dock__command rs-liquid-dock__command--ai" data-dock-action="randai" aria-label="Apri RandAI">
        <span>✦</span><small>RandAI</small>
      </button>
    </div>
  `
  return dock
}

function setOpen(dock, open) {
  dock.classList.toggle('is-open', open)
  dock.querySelectorAll('[data-dock-toggle]').forEach((el) => {
    el.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  dock.querySelector('[data-dock-sheet]')?.setAttribute('aria-hidden', open ? 'false' : 'true')
}

function installGestures(dock) {
  let startY = null
  let startX = null
  let startAt = 0
  const start = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    startY = touch.clientY
    startX = touch.clientX
    startAt = performance.now()
  }
  const end = (event) => {
    if (startY == null || startX == null) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    const dy = touch.clientY - startY
    const dx = touch.clientX - startX
    const duration = performance.now() - startAt
    startY = null
    startX = null
    if (duration > 700 || Math.abs(dy) < 42 || Math.abs(dy) < Math.abs(dx) * 1.15) return
    if (dy < 0) setOpen(dock, true)
    if (dy > 0) setOpen(dock, false)
  }
  dock.addEventListener('touchstart', start, { passive: true })
  dock.addEventListener('touchend', end, { passive: true })
}

function installActions(dock) {
  dock.addEventListener('click', (event) => {
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
    }
  })
}

function mount() {
  if (!window.matchMedia(MOBILE_QUERY).matches) return
  if (document.getElementById(ROOT_ID)) return
  const nav = document.querySelector('.rs-bottomnav')
  if (!(nav instanceof HTMLElement)) return
  const dock = createDock()
  nav.insertAdjacentElement('beforebegin', dock)
  installActions(dock)
  installGestures(dock)
}

export function installLiquidDockPrototype() {
  const tryMount = () => mount()
  tryMount()
  const observer = new MutationObserver(tryMount)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  const onResize = () => {
    const dock = document.getElementById(ROOT_ID)
    if (!window.matchMedia(MOBILE_QUERY).matches) dock?.remove()
    else mount()
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('apice-session-changed', () => window.setTimeout(mount, 80))
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    document.getElementById(ROOT_ID)?.remove()
  }
}
