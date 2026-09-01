import { useEffect } from 'react'
import { loadSession } from '../../session.js'
import { createRandAIContextEnvelope, getRandAIContext, publishRandAIContext } from './envelope.js'

const SESSION_EVENT = 'apice-session-changed'
const VIEW_EVENT = 'randapp-view-changed'

function activeViewFromDom() {
  const current = document.querySelector('[data-testid="bottom-nav"] [aria-current="page"]')
    || document.querySelector('.rs-sidebar__item.active[data-testid]')
  const testId = current?.getAttribute('data-testid') || ''
  if (testId.startsWith('nav-')) return testId.slice(4)
  if (testId.startsWith('sidebar-')) return testId.slice(8)
  return document.querySelector('[data-testid="main-content"]') ? 'home' : null
}

function publishScreenContext(explicitView = null) {
  const session = loadSession()
  if (!session?.hotelId) {
    publishRandAIContext(null)
    return
  }

  const current = getRandAIContext()
  if (current?.hotelId === session.hotelId && current?.resource) return

  const view = explicitView || activeViewFromDom()
  publishRandAIContext(createRandAIContextEnvelope({
    hotelId: session.hotelId,
    actor: { userId: session.userId },
    screen: view ? { view } : null,
  }))
}

export default function RandAIContextBridge() {
  useEffect(() => {
    let queued = false
    const schedule = (view = null) => {
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        publishScreenContext(view)
      })
    }

    const onSession = () => schedule()
    const onView = (event) => schedule(event.detail?.view || null)
    window.addEventListener(SESSION_EVENT, onSession)
    window.addEventListener(VIEW_EVENT, onView)

    const root = document.getElementById('root')
    const observer = root ? new MutationObserver(() => schedule()) : null
    observer?.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current'] })
    schedule()

    return () => {
      window.removeEventListener(SESSION_EVENT, onSession)
      window.removeEventListener(VIEW_EVENT, onView)
      observer?.disconnect()
    }
  }, [])

  return null
}

export { publishScreenContext, activeViewFromDom }
