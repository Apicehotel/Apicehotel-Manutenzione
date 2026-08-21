const INTERVENTI_FLAG = 'randapp.nav.interventi'

const buttonLabel = (button) => button?.querySelector('span')?.textContent?.trim() || ''

function makeToolIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5l-8.9 8.9a2.1 2.1 0 0 0 3 3l8.9-8.9a4 4 0 0 0-.6-5.4Z')
  svg.append(path)
  return svg
}

function openInterventi(nav) {
  const altro = [...nav.querySelectorAll(':scope > button')].find((button) => buttonLabel(button) === 'Altro')
  if (!altro) return
  altro.click()
  requestAnimationFrame(() => {
    const target = [...document.querySelectorAll('.app-drawer nav button')].find((button) => button.textContent?.trim().startsWith('Interventi'))
    target?.click()
  })
}

function syncMobileNav() {
  const nav = document.querySelector('.app-nav')
  if (!nav) return

  nav.querySelector('.app-nav-fab')?.remove()

  const homeInterventi = [...document.querySelectorAll('.dash-card')].some((button) => button.textContent?.includes('Interventi di oggi'))
  if (homeInterventi) sessionStorage.setItem(INTERVENTI_FLAG, '1')
  const canShowInterventi = homeInterventi || sessionStorage.getItem(INTERVENTI_FLAG) === '1'

  let interventi = [...nav.querySelectorAll(':scope > button')].find((button) => buttonLabel(button) === 'Interventi')
  if (canShowInterventi && !interventi) {
    interventi = document.createElement('button')
    interventi.type = 'button'
    interventi.className = 'app-nav-interventi'
    interventi.append(makeToolIcon())
    const label = document.createElement('span')
    label.textContent = 'Interventi'
    interventi.append(label)
    interventi.addEventListener('click', () => openInterventi(nav))
    const planning = [...nav.querySelectorAll(':scope > button')].find((button) => buttonLabel(button) === 'Planning')
    const altro = [...nav.querySelectorAll(':scope > button')].find((button) => buttonLabel(button) === 'Altro')
    nav.insertBefore(interventi, planning || altro || null)
  }

  const isInterventi = Boolean(document.querySelector('.interventions-section'))
  if (interventi) {
    interventi.classList.toggle('active', isInterventi)
    if (isInterventi) interventi.setAttribute('aria-current', 'page')
    else interventi.removeAttribute('aria-current')
  }
  if (isInterventi) {
    const altro = [...nav.querySelectorAll(':scope > button')].find((button) => buttonLabel(button) === 'Altro')
    altro?.classList.remove('active')
  }
}

let scheduled = false
function scheduleSync() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    syncMobileNav()
  })
}

const observer = new MutationObserver(scheduleSync)
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
window.addEventListener('pageshow', scheduleSync)
scheduleSync()
