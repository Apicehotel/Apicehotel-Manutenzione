// Admin section navigation: two real views (Utenti / Sensori) without touching
// the large App.jsx component. The controls are mounted into the existing AdminPanel
// and only switch presentation; SensorsPanel keeps its React state and handlers.

const VIEW_KEY = 'randapp.admin-view'

function getInitialView() {
  try {
    const saved = sessionStorage.getItem(VIEW_KEY)
    return saved === 'sensors' ? 'sensors' : 'users'
  } catch {
    return 'users'
  }
}

function applyView(panel, view) {
  const normalized = view === 'sensors' ? 'sensors' : 'users'
  panel.dataset.adminView = normalized

  const title = panel.querySelector('.admin-heading h1')
  const subtitle = panel.querySelector('.admin-heading p')
  if (title) title.textContent = normalized === 'sensors' ? 'Sensori' : 'Utenti'
  if (subtitle) title && (subtitle.textContent = normalized === 'sensors'
    ? 'Gestisci sensori e visibilità nelle strutture.'
    : 'Gestisci utenti, ruoli e accessi alle strutture.')

  panel.querySelectorAll('.admin-section-nav button').forEach((button) => {
    const active = button.dataset.view === normalized
    button.classList.toggle('active', active)
    button.setAttribute('aria-current', active ? 'page' : 'false')
  })

  try { sessionStorage.setItem(VIEW_KEY, normalized) } catch { /* opzionale */ }
}

function mountAdminNavigation() {
  const panel = document.querySelector('.global-admin .admin-panel')
  if (!panel || panel.querySelector('.admin-section-nav')) return

  const nav = document.createElement('nav')
  nav.className = 'admin-section-nav'
  nav.setAttribute('aria-label', 'Sezioni amministrazione')
  nav.innerHTML = `
    <button type="button" data-view="users"><span class="admin-nav-icon" aria-hidden="true">♙</span><span>Utenti</span></button>
    <button type="button" data-view="sensors"><span class="admin-nav-icon" aria-hidden="true">⌁</span><span>Sensori</span></button>
  `

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]')
    if (!button) return
    applyView(panel, button.dataset.view)
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
