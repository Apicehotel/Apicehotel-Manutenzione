// Groups the existing React drawer buttons into semantic sections without
// replacing their event handlers. Moving DOM nodes preserves React listeners.
// Top-level duplicates (for example PIN management) stay inside the profile.
const UI_SIZE_STORAGE_KEY = 'apicehotel.ui-size.v1'
const UI_SIZES = [
  ['small', 'P', 'Piccolo'],
  ['normal', 'N', 'Normale'],
  ['large', 'G', 'Grande'],
]

const GROUPS = [
  {
    key: 'operations',
    title: 'Operatività',
    items: ['Avvisi urgenti','Housekeeping','Planning lavori','Planning Sale','Temperature','Rubrica tecnici'],
  },
  {
    key: 'profile',
    title: 'Struttura e profilo',
    items: ['Cambia struttura','Il mio profilo'],
  },
  {
    key: 'support',
    title: 'Supporto e dati',
    items: ['Manuale','Feedback','Feedback ricevuti','Esporta CSV'],
  },
  {
    key: 'advanced',
    title: 'Avanzate',
    items: ['Pulisci cache'],
  },
]

const HIDDEN_TOP_LEVEL_ITEMS = new Set(['Cambia PIN'])

function cleanText(button) {
  return String(button?.textContent || '').replace(/›/g, '').replace(/\s+/g, ' ').trim()
}

function decorateButton(button) {
  if (button.dataset.drawerV2Decorated) return
  button.dataset.drawerV2Decorated = '1'
  const chevron = document.createElement('span')
  chevron.className = 'drawer-v2-chevron'
  chevron.setAttribute('aria-hidden', 'true')
  chevron.textContent = '›'
  button.appendChild(chevron)
}

function currentUiSize() {
  const fromDom = document.documentElement.dataset.uiSize
  if (UI_SIZES.some(([value]) => value === fromDom)) return fromDom
  try {
    const saved = localStorage.getItem(UI_SIZE_STORAGE_KEY)
    if (UI_SIZES.some(([value]) => value === saved)) return saved
  } catch { /* storage opzionale */ }
  return 'normal'
}

function syncSizeControls(value) {
  document.querySelectorAll('.drawer-v2-size-control').forEach((control) => {
    control.querySelectorAll('button[data-ui-size-value]').forEach((button) => {
      const active = button.dataset.uiSizeValue === value
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  })
}

function setUiSize(value, { persist = true, emit = true } = {}) {
  if (!UI_SIZES.some(([size]) => size === value)) return
  document.documentElement.dataset.uiSize = value
  if (persist) {
    try { localStorage.setItem(UI_SIZE_STORAGE_KEY, value) } catch { /* storage opzionale */ }
  }
  syncSizeControls(value)
  if (emit) window.dispatchEvent(new CustomEvent('apice-ui-size-changed', { detail: { value } }))
}

function createUiSizeControl() {
  const row = document.createElement('div')
  row.className = 'drawer-v2-size-row'
  row.setAttribute('aria-label', 'Dimensione interfaccia')

  const label = document.createElement('span')
  label.className = 'drawer-v2-size-label'
  label.textContent = 'Dimensione'

  const control = document.createElement('div')
  control.className = 'drawer-v2-size-control'

  UI_SIZES.forEach(([value, shortLabel, fullLabel]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.uiSizeValue = value
    button.textContent = shortLabel
    button.title = fullLabel
    button.setAttribute('aria-label', fullLabel)
    button.addEventListener('click', () => setUiSize(value))
    control.appendChild(button)
  })

  row.append(label, control)
  requestAnimationFrame(() => syncSizeControls(currentUiSize()))
  return row
}

function enhanceDrawer(drawer) {
  if (!drawer || drawer.dataset.drawerV2Ready) return
  const nav = drawer.querySelector(':scope > nav')
  if (!nav) return

  const buttons = [...nav.children].filter((node) => node instanceof HTMLButtonElement)
  if (!buttons.length) return

  const byLabel = new Map()
  buttons.forEach((button) => {
    const label = cleanText(button)
    if (HIDDEN_TOP_LEVEL_ITEMS.has(label)) {
      // The function still exists in React and remains available from profile;
      // it is simply removed from the top-level drawer to avoid duplication.
      button.remove()
      return
    }
    byLabel.set(label, button)
  })

  nav.classList.add('drawer-v2-nav')

  GROUPS.forEach((group) => {
    const entries = group.items
      .map((label) => [label, byLabel.get(label)])
      .filter(([, button]) => Boolean(button))
    if (!entries.length) return

    const section = document.createElement('section')
    section.className = `drawer-v2-group drawer-v2-${group.key}`
    section.setAttribute('aria-label', group.title)

    const heading = document.createElement('div')
    heading.className = 'drawer-v2-heading'
    heading.textContent = group.title

    const card = document.createElement('div')
    card.className = 'drawer-v2-card'

    entries.forEach(([label, button]) => {
      byLabel.delete(label)
      decorateButton(button)
      card.appendChild(button)
    })

    if (group.key === 'advanced') card.appendChild(createUiSizeControl())

    section.append(heading, card)
    nav.appendChild(section)
  })

  // Keep future/role-specific items visible instead of silently losing them.
  const remaining = [...byLabel.entries()]
  if (remaining.length) {
    const section = document.createElement('section')
    section.className = 'drawer-v2-group drawer-v2-more'
    section.setAttribute('aria-label', 'Altro')
    const heading = document.createElement('div')
    heading.className = 'drawer-v2-heading'
    heading.textContent = 'Altro'
    const card = document.createElement('div')
    card.className = 'drawer-v2-card'
    remaining.forEach(([, button]) => {
      decorateButton(button)
      card.appendChild(button)
    })
    section.append(heading, card)
    nav.appendChild(section)
  }

  drawer.dataset.drawerV2Ready = '1'
  syncSizeControls(currentUiSize())
}

function scan() {
  document.querySelectorAll('.app-drawer').forEach(enhanceDrawer)
}

const observer = new MutationObserver(scan)

export function initDrawerMenuV2() {
  // Apply the saved size before the drawer is opened so the whole app uses the
  // same P/N/G state from the start, not only the segmented control.
  setUiSize(currentUiSize(), { persist: false, emit: false })
  scan()
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
