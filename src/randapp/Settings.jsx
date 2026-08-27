import { useState } from 'react'
import { Button, Icon } from './ui.jsx'
import UsersTab from './admin/UsersTab.jsx'
import SensorsTab from './admin/SensorsTab.jsx'
import RolesTab from './admin/RolesTab.jsx'
import AppearanceTab from './admin/AppearanceTab.jsx'

const TABS = [
  { id:'users', icon:'users', label:'Utenti', Component:UsersTab },
  { id:'sensors', icon:'sensor', label:'Sensori', Component:SensorsTab },
  { id:'navigation', icon:'sliders', label:'Ruoli', Component:RolesTab },
  { id:'appearance', icon:'sparkles', label:'Aspetto', Component:AppearanceTab },
]

export default function Settings({initialTab='users',onExit}){
  const [tab,setTab]=useState(TABS.some(t=>t.id===initialTab)?initialTab:'users')
  const active=TABS.find(t=>t.id===tab)||TABS[0]
  const ActiveTab=active.Component
  return <div className="rs-root"><div className="rs-app">
    <header className="rs-settings-head"><div className="rs-settings-head__brand"><Icon name="gear"/><div><b>Impostazioni</b><small>RandApp Manutenzione</small></div></div><Button variant="ghost" size="sm" icon="logout" onClick={onExit}>Esci</Button></header>
    <main className="rs-content"><ActiveTab/></main>
    <nav className="rs-settings-nav">{TABS.map(t=><button key={t.id} className={`rs-navbtn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}><Icon name={t.icon}/><small>{t.label}</small></button>)}<button className="rs-navbtn" onClick={onExit}><Icon name="home"/><small>RandApp</small></button></nav>
  </div></div>
}
