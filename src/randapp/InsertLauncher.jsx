import { Icon, Sheet } from './ui.jsx'

const ACTIONS = [
  { id: 'issue', icon: 'issues', title: 'Nuova segnalazione', subtitle: 'Guasto, camera, zona o problema da gestire' },
  { id: 'urgent', icon: 'warning', title: 'Nuovo allarme', subtitle: 'Crea un avviso urgente per la struttura' },
  { id: 'intervention', icon: 'wrench', title: 'Pianifica intervento', subtitle: 'Crea un intervento pianificato con data, periodo e assegnazione' },
  { id: 'planning-work', icon: 'calendar', title: 'Planning lavori', subtitle: 'Aggiungi un lavoro al planning' },
  { id: 'planning-sale', icon: 'hotel', title: 'Planning sale', subtitle: 'Aggiungi una prenotazione o attività sala' },
  { id: 'randai', icon: 'sparkles', title: 'Chiedi a RandAI', subtitle: 'Apri l’assistente con il contesto della schermata e della struttura attiva' },
]

export default function InsertLauncher({ open, onClose, hotel, user, onPick, allowedActions = null }) {
  const visibleActions=ACTIONS.filter((item)=>item.id==='randai'||(allowedActions?allowedActions[item.id]!==false:true))
  const pick=(id)=>{
    if(id==='randai'){
      onClose?.()
      window.dispatchEvent(new CustomEvent('randai-toggle',{detail:{mode:'open',source:'insert-launcher'}}))
      return
    }
    if(allowedActions&&allowedActions[id]===false)return
    if(id==='intervention'||id==='planning-work'){
      try{sessionStorage.setItem('randapp.insert-source',id)}catch{}
    }
    onPick(id)
  }
  return <Sheet open={open} onClose={onClose} className="rs-insert-shell">
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}><div style={{minWidth:0}}><h2 style={{margin:0,fontFamily:'Sora',fontSize:'1.2rem',color:'var(--rs-text)'}}>Nuovo inserimento</h2><p style={{margin:'4px 0 0',color:'var(--rs-text-2)',fontSize:'.86rem'}}>{hotel?.name||'Struttura'}{user?.name?` · ${user.name}`:''}</p></div></div>
    <div style={{display:'grid',gap:10}}>{visibleActions.map((item)=><button key={item.id} type="button" onClick={()=>pick(item.id)} data-testid={`insert-${item.id}`} style={{width:'100%',display:'grid',gridTemplateColumns:'46px minmax(0,1fr) 22px',alignItems:'center',gap:12,textAlign:'left',padding:14,borderRadius:16,border:'1px solid var(--rs-line)',background:'var(--rs-surface)',color:'var(--rs-text)',boxShadow:'var(--rs-shadow)',cursor:'pointer'}}><span style={{width:46,height:46,borderRadius:14,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:item.id==='urgent'?'var(--rs-warn)':item.id==='randai'?'var(--rs-hotel-accent, var(--rs-cyan))':'var(--rs-cyan)'}}><Icon name={item.icon}/></span><span style={{minWidth:0}}><strong style={{display:'block',fontFamily:'Sora',fontSize:'.95rem',marginBottom:3}}>{item.title}</strong><small style={{display:'block',color:'var(--rs-text-2)',fontSize:'.78rem',lineHeight:1.35}}>{item.subtitle}</small></span><span style={{color:'var(--rs-text-3)'}}><Icon name="chevronRight"/></span></button>)}</div>
    {!visibleActions.length&&<p style={{margin:'14px 2px 0',color:'var(--rs-text-3)',fontSize:'.78rem'}}>Nessun inserimento disponibile per questo ruolo.</p>}
  </Sheet>
}
