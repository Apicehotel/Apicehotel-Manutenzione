import { Icon, Sheet } from './ui.jsx'

const ACTIONS = [
  {
    id: 'issue',
    icon: 'issues',
    title: 'Nuova segnalazione',
    subtitle: 'Guasto, camera, zona o problema da gestire',
  },
  {
    id: 'urgent',
    icon: 'warning',
    title: 'Nuovo allarme',
    subtitle: 'Crea un avviso urgente per la struttura',
  },
  {
    id: 'intervention',
    icon: 'wrench',
    title: 'Nuovo intervento',
    subtitle: 'Pianifica un intervento con data, periodo e assegnazione',
  },
  {
    id: 'planning-work',
    icon: 'calendar',
    title: 'Planning lavori',
    subtitle: 'Apri il calendario dei lavori pianificati',
  },
  {
    id: 'planning-sale',
    icon: 'hotel',
    title: 'Planning sale',
    subtitle: 'Prenotazioni e attività sale',
  },
]

export default function InsertLauncher({ open, onClose, hotel, user, onPick }) {
  const actions = ACTIONS
  const pick = (id) => {
    if (id === 'intervention') {
      try { sessionStorage.setItem('randapp.pending-insert', 'planning-work') } catch { /* il flusso resta navigabile anche senza storage */ }
      onPick('planning-work')
      return
    }
    if (id === 'planning-sale') {
      try { sessionStorage.setItem('randapp.pending-insert', id) } catch { /* il flusso resta navigabile anche senza storage */ }
    }
    onPick(id)
  }
  return (
    <Sheet open={open} onClose={onClose} className="rs-insert-shell">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div style={{minWidth:0}}>
          <h2 style={{margin:0,fontFamily:'Sora',fontSize:'1.2rem',color:'var(--rs-text)'}}>Nuovo inserimento</h2>
          <p style={{margin:'4px 0 0',color:'var(--rs-text-2)',fontSize:'.86rem'}}>{hotel?.name || 'Struttura'}{user?.name ? ` · ${user.name}` : ''}</p>
        </div>
      </div>
      <div style={{display:'grid',gap:10}}>
        {actions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => pick(item.id)}
            data-testid={`insert-${item.id}`}
            style={{
              width:'100%',
              display:'grid',
              gridTemplateColumns:'46px minmax(0,1fr) 22px',
              alignItems:'center',
              gap:12,
              textAlign:'left',
              padding:'14px',
              borderRadius:'16px',
              border:'1px solid var(--rs-line)',
              background:'var(--rs-surface)',
              color:'var(--rs-text)',
              boxShadow:'var(--rs-shadow)',
              cursor:'pointer',
            }}
          >
            <span style={{width:46,height:46,borderRadius:14,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:item.id === 'urgent' ? 'var(--rs-warn)' : 'var(--rs-cyan)'}}><Icon name={item.icon} /></span>
            <span style={{minWidth:0}}>
              <strong style={{display:'block',fontFamily:'Sora',fontSize:'.95rem',marginBottom:3}}>{item.title}</strong>
              <small style={{display:'block',color:'var(--rs-text-2)',fontSize:'.78rem',lineHeight:1.35}}>{item.subtitle}</small>
            </span>
            <span style={{color:'var(--rs-text-3)'}}><Icon name="chevronRight" /></span>
          </button>
        ))}
      </div>
      <p style={{margin:'14px 2px 0',color:'var(--rs-text-3)',fontSize:'.72rem',lineHeight:1.4}}>Stesso stile e stessi temi RandApp. Ogni voce mantiene i propri campi e la propria logica.</p>
    </Sheet>
  )
}
