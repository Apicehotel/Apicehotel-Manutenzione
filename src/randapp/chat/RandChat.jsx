import { useState } from 'react'
import ChatGroups from './ChatGroups.jsx'
import DirectMessages from './DirectMessages.jsx'
import './chat.css'

export default function RandChat({ user, hotel }) {
  const [mode, setMode] = useState('groups')
  if (!user?.chat_enabled) return <section className="rc-empty"><h2>RandChat non abilitata</h2><p>Un amministratore può abilitarla dal pannello Utenti.</p></section>

  return <div className="rc-module" data-testid="randchat">
    <nav className="rc-module-tabs" aria-label="Modalità RandChat">
      <button className={mode === 'groups' ? 'active' : ''} onClick={() => setMode('groups')}>Gruppi</button>
      <button className={mode === 'dm' ? 'active' : ''} onClick={() => setMode('dm')}>🔒 Diretti</button>
    </nav>
    {mode === 'groups' ? <ChatGroups user={user} hotel={hotel} /> : <DirectMessages user={user} hotel={hotel} />}
  </div>
}
