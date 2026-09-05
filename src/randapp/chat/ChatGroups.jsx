import { useLayoutEffect, useRef, useState } from 'react'
import GroupChats from './GroupChats.jsx'
import DirectMessages from './DirectMessages.jsx'
import './chat.css'
import './chat-viewport.css'

function useRandChatViewport(enabled) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!enabled) return undefined
    const node = ref.current
    if (!node) return undefined

    const content = node.closest('.rs-content')
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    content?.classList.add('rs-content--randchat')
    document.body.classList.add('rs-randchat-active')

    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!ref.current) return
        const top = ref.current.getBoundingClientRect().top
        const visual = window.visualViewport
        const viewportBottom = visual ? visual.offsetTop + visual.height : window.innerHeight
        const bottomNav = document.querySelector('.rs-bottomnav')
        const navVisible = bottomNav && window.getComputedStyle(bottomNav).display !== 'none'
        const navTop = navVisible ? bottomNav.getBoundingClientRect().top : viewportBottom
        const bottom = Math.min(viewportBottom, navTop)
        const height = Math.max(180, Math.floor(bottom - top))
        ref.current.style.setProperty('--rc-viewport-h', `${height}px`)
      })
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null
    const header = document.querySelector('.rs-header')
    const nav = document.querySelector('.rs-bottomnav')
    if (header) observer?.observe(header)
    if (nav) observer?.observe(nav)

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
      content?.classList.remove('rs-content--randchat')
      document.body.classList.remove('rs-randchat-active')
    }
  }, [enabled])

  return ref
}

export default function ChatGroups({ user, hotel }) {
  const [mode, setMode] = useState('groups')
  const chatEnabled = Boolean(user?.chat_enabled)
  const viewportRef = useRandChatViewport(chatEnabled)

  if (!chatEnabled) return <section className="rc-empty"><h2>RandChat non abilitata</h2><p>Un amministratore può abilitarla dal pannello Utenti.</p></section>

  return <div ref={viewportRef} className="rc-module" data-testid="randchat">
    <nav className="rc-module-tabs" aria-label="Modalità RandChat">
      <button className={mode === 'groups' ? 'active' : ''} onClick={() => setMode('groups')}>Gruppi</button>
      <button className={mode === 'dm' ? 'active' : ''} onClick={() => setMode('dm')}>🔒 Diretti</button>
    </nav>
    {mode === 'groups' ? <GroupChats user={user} hotel={hotel} /> : <DirectMessages user={user} hotel={hotel} />}
  </div>
}
