import { useMemo, useState } from 'react'
import './home-assistant-preview.css'

const SAMPLE_BUTTONS = [
  { id: 'ewl-101', name: 'Pulsante 1', area: 'Hotel Giò · Piano 1', entity: 'button.sonoff_1000xxxxxx_1' },
  { id: 'ewl-102', name: 'Pulsante 2', area: 'Hotel Giò · Piano 2', entity: 'button.sonoff_1000xxxxxx_2' },
  { id: 'ewl-103', name: 'Pulsante 3', area: 'Chocohotel · Reception', entity: 'button.sonoff_1000yyyyyy_1' },
]

export default function HomeAssistantPreview(){
  const [events,setEvents]=useState([])
  const [online,setOnline]=useState(true)
  const [mode,setMode]=useState('auto')

  const status=useMemo(()=>online?'Bridge preview attivo':'Bridge preview offline',[online])
  const trigger=(button)=>{
    const now=new Date()
    setEvents((items)=>[{id:`${button.id}-${now.getTime()}`,name:button.name,area:button.area,entity:button.entity,time:now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})},...items].slice(0,8))
  }

  return <main className="ha-preview-shell">
    <header className="ha-preview-header">
      <div>
        <small>RANDAI · PREVIEW</small>
        <h1>Home Assistant + eWeLink</h1>
        <p>Prova del flusso SonoffLAN: pulsante eWeLink → Home Assistant → evento RandAI.</p>
      </div>
      <button className="ha-back" onClick={()=>window.location.assign('/randai')}>← RandAI</button>
    </header>

    <section className="ha-status-grid">
      <article><span>Integrazione</span><strong>SonoffLAN</strong><small>Firmware eWeLink originale</small></article>
      <article><span>Modalità</span><strong>{mode.toUpperCase()}</strong><small>LAN con fallback Cloud</small></article>
      <article><span>Stato</span><strong>{online?'ONLINE':'OFFLINE'}</strong><small>{status}</small></article>
    </section>

    <section className="ha-panel">
      <header><div><strong>Configurazione preview</strong><small>Nessuna credenziale reale viene salvata.</small></div></header>
      <div className="ha-config-row">
        <label>Modalità SonoffLAN<select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="auto">Auto</option><option value="local">Solo LAN</option><option value="cloud">Solo Cloud</option></select></label>
        <label className="ha-switch"><input type="checkbox" checked={online} onChange={(e)=>setOnline(e.target.checked)}/><span>Bridge attivo</span></label>
      </div>
      <div className="ha-flow"><span>eWeLink / Sonoff</span><b>→</b><span>Home Assistant</span><b>→</b><span>RandAI</span><b>→</b><span>Automazione / ntfy</span></div>
    </section>

    <section className="ha-panel">
      <header><div><strong>Pulsanti eWeLink</strong><small>Premili per simulare gli eventi ricevuti da Home Assistant.</small></div><span>{SAMPLE_BUTTONS.length} dispositivi demo</span></header>
      <div className="ha-button-grid">
        {SAMPLE_BUTTONS.map((button)=><button key={button.id} disabled={!online} onClick={()=>trigger(button)} className="ha-device-button"><span className="ha-device-icon">●</span><strong>{button.name}</strong><small>{button.area}</small><code>{button.entity}</code><em>Simula pressione</em></button>)}
      </div>
    </section>

    <section className="ha-panel">
      <header><div><strong>Eventi ricevuti</strong><small>Equivalente preview dell'attributo last_triggered / automazione HA.</small></div><button className="ha-clear" onClick={()=>setEvents([])} disabled={!events.length}>Svuota</button></header>
      <div className="ha-events">
        {events.length?events.map((event)=><div className="ha-event" key={event.id}><span className="ha-event-dot"/><div><strong>{event.name}</strong><small>{event.area}</small><code>{event.entity}</code></div><time>{event.time}</time></div>):<div className="ha-empty">Nessun evento. Premi uno dei pulsanti sopra.</div>}
      </div>
    </section>

    <section className="ha-note"><strong>Preview sicura</strong><p>Questa pagina testa UI, flusso eventi e comportamento mobile. Il collegamento reale richiederà l'indirizzo del server Home Assistant e un token dedicato, che non verranno inseriti nel frontend.</p></section>
  </main>
}
