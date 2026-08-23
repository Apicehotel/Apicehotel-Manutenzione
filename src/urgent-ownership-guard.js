const TAKEN_SUFFIX = ' sta andando'

function currentUserName() {
  const identity = document.querySelector('.ops-header .hotel-identity small')
  const text = identity?.textContent?.trim() || ''
  if (!text) return ''
  return text.split('·')[0].trim()
}

function takenByFromText(text = '') {
  const value = String(text).trim()
  if (!value.endsWith(TAKEN_SUFFIX)) return ''
  return value.slice(0, -TAKEN_SUFFIX.length).trim()
}

function setActionVisibility(container, allowed) {
  if (!container) return
  const buttons = [...container.querySelectorAll('button')]
  for (const button of buttons) {
    const label = (button.textContent || '').trim().toLowerCase()
    const isUrgentAction = label === 'fatto' || label === 'trasforma' || label.includes('trasforma in segnalazione')
    if (!isUrgentAction) continue
    button.hidden = !allowed
    button.disabled = !allowed
    button.setAttribute('aria-hidden', allowed ? 'false' : 'true')
  }
}

function syncBannerArticle(article, currentUser) {
  const status = article.querySelector('small')
  const owner = takenByFromText(status?.textContent || '')
  if (!owner) return
  const isOwner = owner.localeCompare(currentUser, 'it', { sensitivity: 'base' }) === 0
  const actions = [...article.children].find((child) => child.querySelector?.('button'))
  setActionVisibility(actions, isOwner)
  if (!isOwner && status) status.textContent = `Preso in carico da ${owner}`
}

function syncUrgentCard(card, currentUser) {
  if (!card.classList.contains('working')) return
  const result = card.querySelector('.urgent-result')
  const owner = takenByFromText(result?.textContent || '') || String(result?.textContent || '').replace(/^Preso in carico da\s+/i, '').trim()
  if (!owner) return
  const isOwner = owner.localeCompare(currentUser, 'it', { sensitivity: 'base' }) === 0
  setActionVisibility(card, isOwner)
  if (!isOwner && result) result.textContent = `Preso in carico da ${owner}`
}

function applyUrgentOwnership() {
  const currentUser = currentUserName()
  if (!currentUser) return
  document.querySelectorAll('.urgent-banner article').forEach((article) => syncBannerArticle(article, currentUser))
  document.querySelectorAll('.urgent-card.working').forEach((card) => syncUrgentCard(card, currentUser))
}

let scheduled = false
function scheduleApply() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    applyUrgentOwnership()
  })
}

export function initUrgentOwnershipGuard() {
  if (typeof window === 'undefined' || window.__apiceUrgentOwnershipGuard) return
  window.__apiceUrgentOwnershipGuard = true

  const observer = new MutationObserver(scheduleApply)
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.urgent-banner article button, .urgent-card.working button')
    if (!button) return
    scheduleApply()
    if (button.hidden || button.disabled || button.getAttribute('aria-hidden') === 'true') {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }, true)

  window.addEventListener('focus', scheduleApply)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleApply() })
  window.addEventListener('apice-session-changed', scheduleApply)

  scheduleApply()
}
