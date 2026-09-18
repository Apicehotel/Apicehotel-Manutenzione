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
    content?.classList.add('rs-content--randchat')
    document.documentElement.classList.add('rs-randchat-active')
    document.body.classList.add('rs-randchat-active')

    return () => {
      content?.classList.remove('rs-content--randchat')
      document.documentElement.classList.remove('rs-randchat-active')
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
