import './capabilities-console.css'

const CAPABILITIES = [
  { id: 'issues', title: 'Segnalazioni', text: 'Priorità, contesto e operatività sulle segnalazioni reali.', action: 'Apri segnalazioni' },
  { id: 'knowledge', title: 'RandGuide', text: 'Procedure, fonti e guida tecnica approvata per struttura.', action: 'Apri conoscenze' },
  { id: 'ecosystem', title: 'RandMind', text: 'Memoria verificata, provenienza, validità e conflitti.', action: 'Apri memoria', anchor: 'randmind' },
  { id: 'ecosystem', title: 'RandBrain', text: 'Routing, autonomia e reasoning governati da RandCore.', action: 'Apri orchestrazione', anchor: 'randbrain' },
  { id: 'ecosystem', title: 'Viking', text: 'Contesto L0/L1/L2 e traccia retrieval senza un runtime parallelo.', action: 'Apri valutazione', anchor: 'viking' },
  { id: 'media', title: 'Media e manuali', text: 'Documentazione tecnica collegata alle strutture.', action: 'Apri documenti' },
]

export default function CapabilitiesConsole({ onOpen }) {
  return <div className="rc-capabilities" data-testid="randai-capabilities">
    <section className="rc-capability-hero">
      <div><small>RANDAI OPERATIVO</small><h2>Tutto ciò che puoi usare, in un solo punto</h2><p>Le capacità interne diventano percorsi chiari. Dati e azioni restano limitati alle strutture autorizzate.</p></div>
      <button onClick={() => onOpen('issues')}>Inizia dalle priorità</button>
    </section>
    <div className="rc-capability-grid">
      {CAPABILITIES.map((item) => <article className="rc-capability-card" key={`${item.title}-${item.anchor || item.id}`}>
        <span className="rc-badge good">Disponibile</span><h3>{item.title}</h3><p>{item.text}</p>
        <button onClick={() => onOpen(item.id, item.anchor)}>{item.action} →</button>
      </article>)}
    </div>
    <div className="rc-access-note" role="note"><strong>Accessi protetti</strong><span>RandAI usa la sessione Supabase corrente. RandApp mantiene il PIN operativo separato, così l’accesso amministrativo non diventa automaticamente accesso sul campo.</span></div>
  </div>
}
