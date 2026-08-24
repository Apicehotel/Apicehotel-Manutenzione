import './mobile-nav-refine.css'

const NAV_KEYS = {
  home: 'home',
  segnalazioni: 'issues',
  interventi: 'interventions',
  planning: 'planning',
  altro: 'other',
}

function navKey(button) {
  const label = (button.querySelector('span')?.textContent || button.textContent || '').trim().toLowerCase()
  return NAV_KEYS[label] || label.replace(/\s+/g, '-') || 'nav'
}

function normalizeNav(nav) {
  const buttons = [...nav.querySelectorAll(':scope > button')]
  if (!buttons.length) return

  const home = buttons.find((button) => navKey(button) === 'home')
  const others = buttons.filter((button) => button !== home)

  buttons.forEach((button) => {
    button.dataset.uiKey = navKey(button)
    delete button.dataset.uiSlot
  })

  // HOME owns the fixed center slot. Other existing destinations fill the
  // remaining four slots without inventing navigation that a role cannot use.
  if (home) home.dataset.uiSlot = '3'
  const slots = ['1', '2', '4', '5']
  others.slice(0, 4).forEach((button, index) => { button.dataset.uiSlot = slots[index] })

  nav.dataset.uiNormalized = 'true'
}

function findCurrentAction() {
  return document.querySelector('.urgent-fab-scoped:not([disabled])')
    || document.querySelector('.planned-fab:not([disabled])')
}

function openHomeCreateMenu() {
  const existing = document.querySelector('.home-fab-main')
  if (existing) {
    existing.click()
    return
  }

  const home = document.querySelector('.app-nav button[data-ui-key="home"]')
  if (!home) return
  home.click()
  window.setTimeout(() => document.querySelector('.home-fab-main')?.click(), 40)
}

function ensureCreateProxy(operations) {
  let button = operations.querySelector(':scope > .unified-create-proxy')
  if (button) return button

  button = document.createElement('button')
  button.type = 'button'
  button.className = 'unified-create-proxy'
  button.setAttribute('aria-label', 'Crea nuovo')
  button.textContent = '+'
  button.addEventListener('click', () => {
    const contextual = findCurrentAction()
    if (contextual) {
      contextual.click()
      return
    }
    openHomeCreateMenu()
  })
  operations.appendChild(button)
  return button
}

function syncUnifiedUi() {
  const operations = document.querySelector('.operations')
  if (!operations || operations.querySelector('.global-admin')) return

  const nav = operations.querySelector('.app-nav')
  if (nav) normalizeNav(nav)
  ensureCreateProxy(operations)
}

export function initUnifiedUiV1() {
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      syncUnifiedUi()
    })
  }

  schedule()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  window.addEventListener('apice-session-changed', schedule)
  window.addEventListener('resize', schedule, { passive: true })

  return () => {
    observer.disconnect()
    window.removeEventListener('apice-session-changed', schedule)
    window.removeEventListener('resize', schedule)
  }
}
