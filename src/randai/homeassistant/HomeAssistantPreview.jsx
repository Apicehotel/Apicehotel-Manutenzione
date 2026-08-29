import { useMemo, useState } from 'react'
import './home-assistant-preview.css'

const HOTELS = [
  { id: 'hotelgio', name: 'Hotel Giò' },
  { id: 'chocohotel', name: 'Chocohotel' },
  { id: 'brigantino', name: 'Il Brigantino' },
]

const INITIAL_BUTTONS = [
  { id: 'ewl-101', hotelId: 'hotelgio', name: 'Pulsante Piano 1', area: 'Piano 1 · Corridoio', action: 'Segnala manutenzione', entity: 'button.sonoff_1000xxxxxx_1', online: true },
  { id: 'ewl-102', hotelId: 'hotelgio', name: 'Pulsante Piano 2', area: 'Piano 2 · Office', action: 'Chiama manutentore', entity: 'button.sonoff_1000xxxxxx_2', online: true },
  { id: 'ewl-103', hotelId: 'chocohotel', name: 'Pulsante Reception', area: 'Reception', action: 'Segnala manutenzione', entity: 'button.sonoff_1000yyyyyy_1', online: true },
  { id: 'ewl-104', hotelId: 'brigantino', name: 'Pulsante Esterno', area: 'Zona esterna', action: 'Allarme urgente', entity: 'button.sonoff_1000zzzzzz_1', online: false },
]

const ACTIONS = ['Segnala manutenzione','Chiama manutentore','Allarme urgente','Invia notifica ntfy']

export default function HomeAssistantPreview(){
  const [hotelId,setHotelId]=useState('hotelgio')
  const [buttons,setButtons]=useState(INITIAL_BUTTONS)
  const [events,setEvents]=useState([])
  const [mode,setMode]=useState('auto')
  const visible=useMemo(()=>buttons.filter((button)=>button.hotelId===hotelId),[buttons,hotelId])
  const hotelName=HOTELS.find((hotel)=>hotel.id===hotelId)?.name||hotelId
  const onlineCount=visible.filter((button)=>button.online).length

  const trigger=(button)=>{
    if(!button.online)return
    const now=new Date()
    setEvents((items)=>[{id:`${button.id}-${now.getTime()}`,button:button.name,area:button.area,action:button.action,hotelId:button.hotelId,time:now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})},...items].slice(0,8))
  }
  const setAction=(id,action)=>setButtons((items)=>items.map((item)=>item.id===id?{...item,action}:item))

  return <main className="ha-preview-shell">
    <header className="ha-preview-header">
      <div>
        <small>RANDAI · PULSANTI HOTEL</small>
        <h1>Gestione pulsanti</h1>
        <p>Scegli l'hotel, guarda dove si trova il pulsante e decidi cosa deve succedere quando viene premuto.</p>
      </div>
      <button className="ha-back" onClick={()=>window.location.assign('/randai')}>← RandAI</button>
    </header>

    <nav className="ha-hotel-tabs" aria-label="Seleziona hotel">
      {HOTELS.map((hotel)=><button key={hotel.id} className={hotel.id===hotelId?'active':''} onClick={()=>setHotelId(hotel.id)}>{hotel.name}</button>)}
    </nav>

    <section className="ha-summary">
      <div><span>Hotel</span><strong>{hotelName}</strong></div>
      <div><span>Pulsanti collegati</span><strong>{visible.length}</strong></div>
      <div><span>Pronti</span><strong>{onlineCount}/{visible.length}</strong></div>
    </section>

    <section className="ha-panel ha-main-panel">
      <header><div><strong>Pulsanti di {hotelName}</strong><small>Ogni riquadro corrisponde a un pulsante fisico.</small></div><button className="ha-add" onClick={()=>alert('Preview: qui aggiungeremo la procedura guidata per associare un nuovo pulsante.')}>+ Aggiungi pulsante</button></header>
      <div className="ha-button-grid">
        {visible.map((button)=><article className={`ha-device-card ${button.online?'':'offline'}`} key={button.id}>
          <div className="ha-device-top"><span className="ha-device-icon">●</span><span className={`ha-state ${button.online?'ok':'bad'}`}>{button.online?'Pronto':'Offline'}</span></div>
          <h2>{button.name}</h2>
          <p className="ha-location">📍 {button.area}</p>
          <label>Cosa deve fare
            <select value={button.action} onChange={(e)=>setAction(button.id,e.target.value)}>{ACTIONS.map((action)=><option key={action}>{action}</option>)}</select>
          </label>
          <button className="ha-test" disabled={!button.online} onClick={()=>trigger(button)}>{button.online?'Prova il pulsante':'Pulsante non raggiungibile'}</button>
        </article>)}
        {!visible.length&&<div className="ha-empty">Nessun pulsante associato a questo hotel.</div>}
      </div>
    </section>

    <section className="ha-panel">
      <header><div><strong>Ultime pressioni</strong><small>Qui RandAI mostra cosa è successo davvero.</small></div><button className="ha-clear" onClick={()=>setEvents([])} disabled={!events.length}>Svuota</button></header>
      <div className="ha-events">
        {events.length?events.map((event)=><div className="ha-event" key={event.id}><span className="ha-event-dot"/><div><strong>{event.action}</strong><small>{event.button} · {event.area}</small></div><time>{event.time}</time></div>):<div className="ha-empty">Nessuna pressione registrata. Premi “Prova il pulsante”.</div>}
      </div>
    </section>

    <details className="ha-technical">
      <summary>Dettagli tecnici Home Assistant</summary>
      <div className="ha-tech-body">
        <div><span>Integrazione</span><strong>SonoffLAN</strong><small>eWeLink originale · LAN + Cloud</small></div>
        <label>Connessione<select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="auto">Automatica</option><option value="local">Solo rete locale</option><option value="cloud">Solo cloud</option></select></label>
        <p>Home Assistant resta il ponte tecnico. Per chi usa RandAI bastano hotel, posizione, azione e stato del pulsante.</p>
      </div>
    </details>
  </main>
}
