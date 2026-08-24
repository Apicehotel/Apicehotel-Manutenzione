import { HOTELS } from './config.js'
import { fetchDirectory } from './users-data.js'
import { loginWithPin } from './auth-data.js'
import { loadSession, saveSession } from './session.js'

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('it')

function uniqueDirectory(rowsByHotel) {
  const map = new Map()
  rowsByHotel.forEach(({ hotelId, users }) => {
    users.forEach((user) => {
      const key = user.auth_user_id || user.legacy_id || user.id || normalize(user.name)
      if (!key) return
      const current = map.get(key) || { ...user, _hotelIds: [] }
      current._hotelIds = Array.from(new Set([...(current._hotelIds || []), hotelId, ...(Array.isArray(user.hotels) ? user.hotels : [])]))
      map.set(key, current)
    })
  })
  return Array.from(map.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
}

async function loadAllDirectories() {
  const results = await Promise.all(HOTELS.map(async (hotel) => {
    try {
      const result = await fetchDirectory(hotel.id)
      return { hotelId: hotel.id, users: result?.users || [] }
    } catch {
      return { hotelId: hotel.id, users: [] }
    }
  }))
  return uniqueDirectory(results)
}

function renderShell(host) {
  host.innerHTML = `
    <div class="dark-entry-shell">
      <section class="dark-entry-brand" aria-label="RandApp Manutenzione">
        <img src="/logos/apicehotel-mascot.png" alt="ApiceHotel" />
        <div class="dark-entry-brandcopy">
          <strong>RandApp</strong>
          <span>Manutenzione</span>
          <p><b>✓</b> Piattaforma per la gestione e<br>manutenzione delle strutture</p>
        </div>
      </section>
      <section class="dark-entry-card">
        <header><h1>Bentornato</h1><p>Accedi per continuare</p></header>
        <form class="dark-entry-form">
          <label class="dark-entry-field dark-entry-userfield">
            <span class="dark-entry-icon">♙</span>
            <input name="user" autocomplete="username" placeholder="Utente" aria-label="Utente" />
          </label>
          <div class="dark-entry-suggestions" hidden></div>
          <label class="dark-entry-field">
            <span class="dark-entry-icon">▣</span>
            <input name="pin" inputmode="numeric" autocomplete="current-password" maxlength="4" pattern="[0-9]{4}" placeholder="PIN" aria-label="PIN" />
          </label>
          <p class="dark-entry-error" role="alert" hidden></p>
          <button class="dark-entry-primary" type="submit"><span>ACCEDI</span><b>→</b></button>
        </form>
        <div class="dark-entry-divider"><span>oppure</span></div>
        <button class="dark-entry-settings" type="button"><span class="gear">⚙</span><span><b>Impostazioni</b><small>Configura l'app e le preferenze</small></span><i>›</i></button>
      </section>
    </div>`
}

function installGlobalEntry() {
  if (loadSession()) return
  const root = document.getElementById('root')
  if (!root || document.getElementById('approved-dark-entry')) return
  // While Settings/Admin is open, never cover it with the unauthenticated entry.
  if (root.querySelector('.admin-gate-page') || root.querySelector('.global-admin')) return

  const overlay = document.createElement('div')
  overlay.id = 'approved-dark-entry'
  renderShell(overlay)
  document.body.appendChild(overlay)

  const form = overlay.querySelector('.dark-entry-form')
  const userInput = form.elements.user
  const pinInput = form.elements.pin
  const suggestions = overlay.querySelector('.dark-entry-suggestions')
  const error = overlay.querySelector('.dark-entry-error')
  const submit = overlay.querySelector('.dark-entry-primary')
  const settings = overlay.querySelector('.dark-entry-settings')
  let directory = []
  let matched = null

  const showError = (message) => {
    error.textContent = message
    error.hidden = !message
  }

  const renderSuggestions = () => {
    const q = normalize(userInput.value)
    const matches = q ? directory.filter((user) => normalize(user.name).includes(q)).slice(0, 6) : []
    suggestions.innerHTML = ''
    if (!q || !matches.length) { suggestions.hidden = true; return }
    matches.forEach((user) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.innerHTML = `<b>${user.name}</b><small>${user.role || ''}</small>`
      button.addEventListener('click', () => {
        matched = user
        userInput.value = user.name
        suggestions.hidden = true
        pinInput.focus()
      })
      suggestions.appendChild(button)
    })
    suggestions.hidden = false
  }

  userInput.addEventListener('input', () => { matched = null; showError(''); renderSuggestions() })
  userInput.addEventListener('focus', renderSuggestions)
  pinInput.addEventListener('input', () => { pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4); showError('') })

  loadAllDirectories().then((rows) => { directory = rows }).catch(() => { directory = [] })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    showError('')
    const typed = normalize(userInput.value)
    const user = matched || directory.find((item) => normalize(item.name) === typed)
    if (!user) { showError('Seleziona un utente valido'); return }
    if (pinInput.value.length !== 4) { showError('Inserisci il PIN di 4 cifre'); return }
    const hotelIds = Array.from(new Set([...(Array.isArray(user.hotels) ? user.hotels : []), ...(user._hotelIds || [])])).filter(Boolean)
    if (!hotelIds.length) { showError('Nessuna struttura abilitata per questo utente'); return }

    submit.disabled = true
    submit.querySelector('span').textContent = 'ACCESSO…'
    let lastError = null
    for (const hotelId of hotelIds) {
      try {
        const authSession = await loginWithPin({ hotelId, userId: user.legacy_id || user.id, pin: pinInput.value })
        const authUserId = authSession?.user?.id || user.id
        saveSession({ hotelId, userId: authUserId, createdAt: Date.now() })
        window.location.reload()
        return
      } catch (err) { lastError = err }
    }
    console.warn('Accesso RandApp non riuscito', lastError)
    showError('Utente o PIN non validi')
    submit.disabled = false
    submit.querySelector('span').textContent = 'ACCEDI'
  })

  settings.addEventListener('click', () => {
    const adminButton = root.querySelector('.home-admin')
    if (adminButton) {
      overlay.remove()
      adminButton.click()
      return
    }
    showError('Impostazioni non ancora disponibili')
  })
}

export function initApprovedDarkShellEntry() {
  let timer = null
  const run = () => {
    clearTimeout(timer)
    timer = setTimeout(installGlobalEntry, 50)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true })
  else run()

  // React swaps Home/Admin views without reloading. Re-check after each swap so
  // Home from Settings returns to the approved RandApp entry, never the old hotel selector.
  const root = document.getElementById('root')
  if (root) {
    const observer = new MutationObserver(run)
    observer.observe(root, { childList: true, subtree: true })
  }
}
