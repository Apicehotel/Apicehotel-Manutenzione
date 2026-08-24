import { ROLES } from './config.js'
import { supabase } from './supabase.js'

const CONFIG_KEY = 'role_navigation_v1'
const PLACEMENTS = ['bottom', 'side', 'off']

const ITEMS = [
  ['home', 'Home'],
  ['issues', 'Segnalazioni'],
  ['interventions', 'Interventi'],
  ['planning_work', 'Planning lavori'],
  ['planning_sale', 'Planning Sale'],
  ['housekeeping', 'Housekeeping'],
  ['temperature', 'Temperature'],
  ['urgent', 'Avvisi urgenti'],
  ['technicians', 'Rubrica tecnici'],
  ['structure', 'Cambia struttura'],
  ['profile', 'Il mio profilo'],
  ['manual', 'Manuale'],
  ['feedback', 'Feedback'],
  ['feedback_received', 'Feedback ricevuti'],
  ['export', 'Esporta CSV'],
  ['cache', 'Pulisci cache'],
  ['other', 'Altro'],
]

const DEFAULT_ROLE = Object.fromEntries(ITEMS.map(([key]) => [key, 'off']))

function cloneDefaults() {
  return Object.fromEntries(ROLES.map((role) => [role, { ...DEFAULT_ROLE }]))
}

function normalize(raw) {
  const next = cloneDefaults()
  if (!raw || typeof raw !== 'object') return next
  for (const role of ROLES) {
    const source = raw[role]
    if (!source || typeof source !== 'object') continue
    for (const [key] of ITEMS) {
      if (PLACEMENTS.includes(source[key])) next[role][key] = source[key]
    }
  }
  return next
}

async function loadConfig() {
  if (!supabase) return cloneDefaults()
  const { data, error } = await supabase.from('app_config').select('value').eq('key', CONFIG_KEY).maybeSingle()
  if (error) throw error
  if (!data?.value) return cloneDefaults()
  try { return normalize(JSON.parse(data.value)) } catch { return cloneDefaults() }
}

async function saveConfig(config) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { error } = await supabase.from('app_config').update({ value: JSON.stringify(config) }).eq('key', CONFIG_KEY)
  if (error) throw error
}

function roleBottomCount(config, role) {
  return Object.values(config[role] || {}).filter((value) => value === 'bottom').length
}

function makeSegment(role, key, current, onChange) {
  const wrap = document.createElement('div')
  wrap.className = 'role-nav-segment'
  const labels = [['bottom','Sotto'],['side','Laterale'],['off','Off']]
  labels.forEach(([value,label]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.value = value
    button.textContent = label
    button.classList.toggle('active', current === value)
    button.setAttribute('aria-pressed', String(current === value))
    button.addEventListener('click', () => onChange(role, key, value, wrap))
    wrap.appendChild(button)
  })
  return wrap
}

function render(panel, config) {
  panel.innerHTML = ''
  const intro = document.createElement('div')
  intro.className = 'role-nav-intro'
  intro.innerHTML = '<strong>Barra sotto / menu laterale</strong><span>Per ogni ruolo scegli dove mostrare ogni funzione. Off la disattiva dalla navigazione. Massimo 5 voci nella barra sotto.</span>'
  panel.appendChild(intro)

  const status = document.createElement('div')
  status.className = 'role-nav-status'
  panel.appendChild(status)

  const list = document.createElement('div')
  list.className = 'role-nav-role-list'
  panel.appendChild(list)

  const updateStatus = (message, tone = '') => {
    status.textContent = message
    status.dataset.tone = tone
  }

  const onChange = (role, key, value, segment) => {
    const previous = config[role][key]
    config[role][key] = value
    if (value === 'bottom' && roleBottomCount(config, role) > 5) {
      config[role][key] = previous
      updateStatus(`La barra sotto di ${role} può contenere al massimo 5 voci.`, 'error')
      return
    }
    segment.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.value === value
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
    const counter = list.querySelector(`[data-bottom-count="${CSS.escape(role)}"]`)
    if (counter) counter.textContent = `${roleBottomCount(config, role)}/5 sotto`
    updateStatus('Modifica non ancora salvata.', 'dirty')
  }

  ROLES.forEach((role, index) => {
    const details = document.createElement('details')
    details.className = 'role-nav-role'
    if (index === 0) details.open = true

    const summary = document.createElement('summary')
    const name = document.createElement('strong')
    name.textContent = role
    const count = document.createElement('span')
    count.dataset.bottomCount = role
    count.textContent = `${roleBottomCount(config, role)}/5 sotto`
    summary.append(name, count)
    details.appendChild(summary)

    const grid = document.createElement('div')
    grid.className = 'role-nav-grid'
    ITEMS.forEach(([key,label]) => {
      const row = document.createElement('div')
      row.className = 'role-nav-row'
      const text = document.createElement('span')
      text.className = 'role-nav-label'
      text.textContent = label
      row.append(text, makeSegment(role, key, config[role][key], onChange))
      grid.appendChild(row)
    })
    details.appendChild(grid)
    list.appendChild(details)
  })

  const actions = document.createElement('div')
  actions.className = 'role-nav-actions'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'secondary'
  reset.textContent = 'Azzera selezioni'
  reset.addEventListener('click', () => {
    const fresh = cloneDefaults()
    Object.assign(config, fresh)
    render(panel, config)
    const freshStatus = panel.querySelector('.role-nav-status')
    if (freshStatus) { freshStatus.textContent = 'Selezioni azzerate, premi Salva per confermare.'; freshStatus.dataset.tone = 'dirty' }
  })

  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'primary'
  save.textContent = 'Salva configurazione'
  save.addEventListener('click', async () => {
    save.disabled = true
    updateStatus('Salvataggio…')
    try {
      await saveConfig(config)
      updateStatus('Configurazione salvata sul database condiviso.', 'success')
    } catch (error) {
      updateStatus(error?.message || 'Salvataggio non riuscito.', 'error')
    } finally {
      save.disabled = false
    }
  })
  actions.append(reset, save)
  panel.appendChild(actions)
}

export async function mountRoleNavigationConfig(adminPanel) {
  if (!adminPanel || adminPanel.querySelector('.role-nav-config-panel')) return
  const panel = document.createElement('section')
  panel.className = 'role-nav-config-panel'
  panel.innerHTML = '<div class="role-nav-loading">Caricamento configurazione…</div>'
  adminPanel.appendChild(panel)
  try {
    const config = await loadConfig()
    render(panel, config)
  } catch (error) {
    panel.innerHTML = `<div class="role-nav-error">${String(error?.message || 'Impossibile caricare la configurazione.')}</div>`
  }
}
