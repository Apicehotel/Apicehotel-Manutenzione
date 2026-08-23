// Groups the existing React drawer buttons into semantic sections without
// replacing their event handlers. Moving DOM nodes preserves React listeners.
const GROUPS = [
  {
    key: 'operations',
    title: 'Operatività',
    items: ['Feedback ricevuti','Housekeeping','Avvisi urgenti','Planning lavori','Planning Sale','Temperature','Rubrica tecnici'],
  },
  {
    key: 'profile',
    title: 'Struttura e profilo',
    items: ['Cambia struttura','Il mio profilo','Cambia PIN'],
  },
  {
    key: 'support',
    title: 'Supporto e dati',
    items: ['Manuale','Feedback','Esporta CSV'],
  },
  {
    key: 'advanced',
    title: 'Avanzate',
    items: ['Pulisci cache'],
  },
]

function cleanText(button) {
  return String(button?.textContent || '').replace(/\s+/g, ' ').trim()
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

  const byLabel = new Map(buttons.map((button) => [cleanText(button), button]))
  nav.classList.add('drawer-v2-nav')

  GROUPS.forEach((group) => {
    const visibleButtons = group.items.map((label) => byLabel.get(label)).filter(Boolean)
    if (!visibleButtons.length) return

    const section = document.createElement('section')
    section.className = `drawer-v2-group drawer-v2-${group.key}`
    section.setAttribute('aria-label', group.title)

    const heading = document.createElement('div')
    heading.className = 'drawer-v2-heading'
    heading.textContent = group.title

    const card = document.createElement('div')
    card.className = 'drawer-v2-card'

    visibleButtons.forEach((button) => {
      decorateButton(button)
      card.appendChild(button)
      byLabel.delete(cleanText(button))
    })

    section.append(heading, card)
    nav.appendChild(section)
  })

  // Keep any future/role-specific items visible instead of losing them.
  const remaining = [...byLabel.values()]
  if (remaining.length) {
    const section = document.createElement('section')
    section.className = 'drawer-v2-group drawer-v2-more'
    section.setAttribute('aria-label', 'Altro')
    const heading = document.createElement('div')
    heading.className = 'drawer-v2-heading'
    heading.textContent = 'Altro'
    const card = document.createElement('div')
    card.className = 'drawer-v2-card'
    remaining.forEach((button) => { decorateButton(button); card.appendChild(button) })
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
