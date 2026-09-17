import AppShell from './AppShell.jsx'
import './preview.css'

const nav = [
  ['Operatività','⚒'],
  ['Planning','▣'],
  ['Home','⌂'],
  ['Task','✓'],
  ['RandAI','✦'],
]

function Header(){
  return <header className="rui2-header">
    <div className="rui2-brand"><span className="rui2-brandmark">R</span><div><strong>RandApp</strong><small>Hotel Giò · Perugia</small></div></div>
    <div className="rui2-header-actions"><button aria-label="Notifiche">◌</button><button className="rui2-avatar" aria-label="Profilo">DC</button></div>
  </header>
}

function Sidebar(){
  return <div className="rui2-side">
    <div className="rui2-side-title">MENU</div>
    {['Home','Operatività','Planning','Segnalazioni','Interventi','Housekeeping','Rifornimenti','Magazzino','RandAI'].map((item,i)=><button className={i===0?'is-active':''} key={item}><span>{['⌂','⚒','▣','!','↗','▤','□','▦','✦'][i]}</span>{item}</button>)}
  </div>
}

function BottomNav(){
  return <div className="rui2-bottomnav">{nav.map(([label,icon],i)=><button className={i===2?'is-active':''} key={label}><span>{icon}</span><small>{label}</small></button>)}</div>
}

function Stat({label,value,note}){return <article className="rui2-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}

export default function RandUiV2Preview(){
  return <AppShell header={<Header/>} sidebar={<Sidebar/>} bottomNav={<BottomNav/>} drawer={null}>
    <section className="rui2-page">
      <div className="rui2-hero"><div><span className="rui2-eyebrow">GIOVEDÌ 17 SETTEMBRE</span><h1>Buongiorno, Domenico</h1><p>Quello che richiede attenzione oggi, senza rumore.</p></div><button className="rui2-primary">+ Nuovo</button></div>

      <div className="rui2-stats"><Stat label="Priorità" value="3" note="2 urgenti · 1 scaduta"/><Stat label="In corso" value="8" note="Interventi aperti"/><Stat label="Sale oggi" value="4" note="Prossima 09:30"/></div>

      <div className="rui2-grid">
        <section className="rui2-card rui2-card--priority"><div className="rui2-card-head"><div><span className="rui2-kicker">PRIORITÀ</span><h2>Da fare adesso</h2></div><button>Vedi tutto</button></div>
          <div className="rui2-list">
            <div className="rui2-row"><span className="rui2-dot urgent"></span><div><strong>Perdita acqua · Camera 214</strong><small>Hotel Giò · Jazz · 6 min fa</small></div><b>Urgente</b></div>
            <div className="rui2-row"><span className="rui2-dot"></span><div><strong>Controllo climatizzazione Sala A</strong><small>Planning · entro 09:15</small></div><b>Oggi</b></div>
            <div className="rui2-row"><span className="rui2-dot warm"></span><div><strong>Rifornimento office 3° piano</strong><small>Housekeeping · Wine</small></div><b>In attesa</b></div>
          </div>
        </section>

        <section className="rui2-card"><div className="rui2-card-head"><div><span className="rui2-kicker">OPERATIVITÀ</span><h2>Stato hotel</h2></div><span className="rui2-live">● Live</span></div>
          <div className="rui2-health"><div><span>Segnalazioni</span><strong>5</strong></div><div><span>Interventi</span><strong>8</strong></div><div><span>Urgenze</span><strong>2</strong></div><div><span>Task</span><strong>7</strong></div></div>
        </section>

        <section className="rui2-card"><div className="rui2-card-head"><div><span className="rui2-kicker">PLANNING</span><h2>Prossimi impegni</h2></div><button>Apri</button></div>
          <div className="rui2-timeline"><div><time>09:30</time><span></span><p><strong>Sala A · Meeting</strong><small>Platea · 35 pax</small></p></div><div><time>11:00</time><span></span><p><strong>Sala B · Allestimento</strong><small>Scuola · audio/video</small></p></div><div><time>15:00</time><span></span><p><strong>Housekeeping</strong><small>Controllo piani Jazz</small></p></div></div>
        </section>

        <section className="rui2-card rui2-ai"><div><span className="rui2-kicker">RANDAI</span><h2>Ti serve una mano?</h2><p>Chiedimi cosa succede in hotel, cosa manca o cosa conviene fare prima.</p></div><button>Apri RandAI ✦</button></section>
      </div>
    </section>
  </AppShell>
}
