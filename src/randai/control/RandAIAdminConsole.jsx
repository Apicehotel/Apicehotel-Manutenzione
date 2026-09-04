import { useState } from 'react'
import UsersTab from '../../randapp/admin/UsersTab.jsx'
import RolesTab from '../../randapp/admin/RolesTab.jsx'
import RandAIKnowledgeConsole from '../console/RandAIConsole.jsx'
import RandAIConfigurationConsole from './RandAIConfigurationConsole.jsx'
import './randai-admin-console.css'

const TABS = [
  ['users', 'Utenti'],
  ['permissions', 'Permessi e menu'],
  ['runtime', 'RandAI'],
  ['guide', 'RandGuide'],
]

export default function RandAIAdminConsole({ accessHotels = [], hotelFilter = 'all' }) {
  const [tab, setTab] = useState('users')
  const content = {
    users: <UsersTab />,
    permissions: <RolesTab />,
    runtime: <RandAIConfigurationConsole accessHotels={accessHotels} hotelFilter={hotelFilter} />,
    guide: <RandAIKnowledgeConsole />,
  }[tab]

  return <section className="rc-admin-console" data-testid="randai-admin-console">
    <header className="rc-admin-console__head">
      <div><small>CONFIGURAZIONE UNICA</small><h2>Amministrazione RandAI</h2><p>Utenti, permessi, funzioni, RandAI e RandGuide si configurano da qui.</p></div>
    </header>
    <nav className="rc-admin-console__tabs" aria-label="Configurazione RandAI">
      {TABS.map(([key, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}
    </nav>
    <div className="rc-admin-console__content">{content}</div>
  </section>
}
