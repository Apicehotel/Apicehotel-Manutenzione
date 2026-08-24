import { mountRoleNavigationConfig } from './role-navigation-config.js'

// Admin section navigation: real views (Utenti / Sensori / Navigazione) plus Home action.
const VIEW_KEY = 'randapp.admin-view'
const VIEWS = new Set(['users','sensors','navigation'])

function getInitialView() {
  try {
    const saved = sessionStorage.getItem(VIEW_KEY)
    return VIEWS.has(saved) ? saved : 'users'
  } catch {
    return 'users'
  }
}

function applyView(panel, view) {
  const normalized = VIEWS.has(view) ? view : 'users'
  panel.dataset.adminView = normalized

  const title = panel.querySelector('.admin-heading h1')
  const subtitle = panel.querySelector('.admin-heading p')
  const copy = {
    users: ['Utenti', 'Gestisci utenti, ruoli e accessi alle strutture.'],
    sensors: ['Sensori', 'Gestisci sensori e visibilità nelle strutture.'],
    navigation: ['Navigazione', 'Scegli cosa mostrare sotto, nel menu laterale o disattivare per ogni ruolo.'],
  }
  if (title) title.textContent = copy[normalized][0]
  if (subtitle) subtitle.textContent = copy[normalized][1]

  panel.querySelectorAll('.admin-section-nav button[data-view]').forEach((button) => {
    const active = button.dataset.view === normalized
    button.classList.toggle('active', active)
    button.setAttribute('aria-current', active ? 'page' : 'false')
  })

  if (normalized === 'navigation') mountRoleNavigationConfig(panel)
  try { sessionStorage.setItem(VIEW_KEY, normalized) } catch { /* opzionale */ }
}

function goHome(panel) {
  const home = panel.querySelector('.admin-heading .back-link') || document.querySelector('.global-admin .back-link')
  if (home) home.click()
}

function mountAdminNavigation() {
  const panel = document.querySelector('.global-admin .admin-panel')
  if (!panel || panel.querySelector('.admin-section-nav')) return

  const nav = document.createElement('nav')
  nav.className = 'admin-section-nav'
  nav.setAttribute('aria-label', 'Navigazione pannello admin')
  nav.innerHTML = `
    <button type="button" data-view="users"><span class="admin-nav-icon" aria-hidden="true">♙</span><span>Utenti</span></button>
    <button type="button" data-view="sensors"><span class="admin-nav-icon" aria-hidden="true">⌁</span><span>Sensori</span></button>
    <button type="button" data-view="navigation"><span class="admin-nav-icon" aria-hidden="true">☷</span><span>Navigazione</span></button>
    <button type="button" data-action="home"><span class="admin-nav-icon" aria-hidden="true">⌂</span><span>Home</span></button>
  `

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button) return
    if (button.dataset.action === 'home') {
      goHome(panel)
      return
    }
    if (button.dataset.view) applyView(panel, button.dataset.view)
  })

  panel.prepend(nav)
  applyView(panel, getInitialView())
}

const observer = new MutationObserver(() => mountAdminNavigation())

export function initAdminSectionNavigation() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAdminNavigation, { once: true })
  } else {
    mountAdminNavigation()
  }
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
