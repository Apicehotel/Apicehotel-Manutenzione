// Groups the existing React drawer buttons into semantic sections without
// replacing their event handlers. Moving DOM nodes preserves React listeners.
// The drawer intentionally exposes only top-level destinations: settings such
// as PIN management stay inside "Il mio profilo" instead of being duplicated.
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

// Destinations already reachable from another top-level screen should not be
// duplicated in the drawer. Their underlying React functionality is untouched.
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
      button.hidden = true
      button.setAttribute('aria-hidden', 'true')
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
      // Delete using the original label BEFORE decorating. Previously the
      // appended chevron changed textContent and caused every item to fall
      // through into the catch-all "Altro" section.
      byLabel.delete(label)
      decorateButton(button)
      card.appendChild(button)
    })

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
}

function scan() {
  document.querySelectorAll('.app-drawer').forEach(enhanceDrawer)
}

const observer = new MutationObserver(scan)

export function initDrawerMenuV2() {
  scan()
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
