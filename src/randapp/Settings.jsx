import { useState } from 'react'
import { Button, Icon } from './ui.jsx'
import { SettingsTemplate } from './randui/templates.jsx'
import UsersTab from './admin/UsersTab.jsx'
import SensorsTab from './admin/SensorsTab.jsx'
import RolesTab from './admin/RolesTab.jsx'
import UsageTab from './admin/UsageTab.jsx'
import DiagnosticsTab from './admin/DiagnosticsTab.jsx'

const TABS = [
  { id:'users', icon:'users', label:'Utenti', Component:UsersTab },
  { id:'sensors', icon:'sensor', label:'Sensori', Component:SensorsTab },
  { id:'navigation', icon:'sliders', label:'Ruoli', Component:RolesTab },
  { id:'usage', icon:'activity', label:'Consumi', Component:UsageTab },
  { id:'diagnostics', icon:'wrench', label:'Diagnostica', Component:DiagnosticsTab },
]

function SettingsContent({ initialTab='users', onExit, embedded=false }) {
  const [tab,setTab]=useState(TABS.some((item)=>item.id===initialTab)?initialTab:'users')
  const active=TABS.find((item)=>item.id===tab)||TABS[0]
  const ActiveTab=active.Component
  const toolbar=(
    <nav className="rs-randui-tabs" aria-label="Sezioni impostazioni">
      {TABS.map((item)=>(
        <button
          type="button"
          key={item.id}
          className={`rs-randui-tab ${tab===item.id?'active':''}`}
          onClick={()=>setTab(item.id)}
          role="tab"
          aria-selected={tab===item.id}
          aria-controls="settings-panel"
        >
          <Icon name={item.icon}/><span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
  return (
    <SettingsTemplate
      eyebrow="RandUI · Gestione"
      title="Impostazioni"
      description="Utenti, ruoli, sensori, consumi e diagnostica in un unico spazio amministrativo."
      toolbar={toolbar}
      actions={<Button type="button" variant="ghost" size="sm" icon="chevronLeft" onClick={onExit}>{embedded?'Torna all’app':'Indietro'}</Button>}
    >
      <div id="settings-panel" role="tabpanel" aria-label={active.label}><ActiveTab/></div>
    </SettingsTemplate>
  )
}

export default function Settings(props){
  if(props.embedded) return <SettingsContent {...props}/>
  return <div className="rs-root"><div className="rs-app"><main className="rs-content rs-content--flush"><SettingsContent {...props}/></main></div></div>
}
