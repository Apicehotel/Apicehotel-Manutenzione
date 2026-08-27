import { Icon } from './ui.jsx'

const ACTIONS = [
  { id: 'issue', icon: 'issues', title: 'Nuova segnalazione', subtitle: 'Guasto, camera, zona o problema da gestire' },
  { id: 'urgent', icon: 'warning', title: 'Nuovo allarme', subtitle: 'Crea un avviso urgente per la struttura' },
  { id: 'intervention', icon: 'wrench', title: 'Pianifica intervento', subtitle: 'Crea un intervento pianificato con data, periodo e assegnazione' },
  { id: 'planning-work', icon: 'calendar', title: 'Planning lavori', subtitle: 'Aggiungi un lavoro al planning' },
  { id: 'planning-sale', icon: 'hotel', title: 'Planning sale', subtitle: 'Aggiungi una prenotazione o attività sala' },
]
const normalize=(value='')=>String(value).trim().toLocaleLowerCase('it')
const canManageSale=(user)=>normalize(user?.role)==='direttore centro congressi'

export default function InsertLauncher({ open, onClose, hotel, user, onPick }) {
  const managesSale=canManageSale(user)
  const visibleActions=ACTIONS.filter((item)=>item.id!=='planning-sale'||managesSale)
  const pick=(id)=>{
    if(id==='intervention'||id==='planning-work'){
      try{sessionStorage.setItem('randapp.insert-source',id)}catch{}
    }
    onPick(id)
  }
  if(!open)return null

  return <div
    role="presentation"
    onClick={onClose}
    style={{position:'fixed',inset:0,zIndex:70,background:'rgba(3,6,12,.38)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Nuovo inserimento"
      onClick={e=>e.stopPropagation()}
      style={{position:'fixed',left:'max(12px,env(safe-area-inset-left))',right:'max(12px,env(safe-area-inset-right))',bottom:'calc(var(--rs-nav-h) + var(--rs-safe-bottom) + 86px)',zIndex:71,maxWidth:520,margin:'0 auto',padding:12,borderRadius:22,border:'1px solid var(--rs-line-strong)',background:'color-mix(in srgb,var(--rs-surface) 94%,transparent)',boxShadow:'0 24px 70px -24px rgba(0,0,0,.9)',maxHeight:'min(62dvh,520px)',overflowY:'auto',overscrollBehavior:'contain'}}
    >
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'2px 2px 10px'}}>
        <div style={{minWidth:0,flex:1}}>
          <h2 style={{margin:0,fontFamily:'Sora',fontSize:'1rem',color:'var(--rs-text)'}}>Inserisci</h2>
          <p style={{margin:'2px 0 0',color:'var(--rs-text-3)',fontSize:'.72rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{hotel?.name||'Struttura'}{user?.name?` · ${user.name}`:''}</p>
        </div>
        <button type="button" className="rs-iconbtn" onClick={onClose} aria-label="Chiudi" style={{width:36,height:36,borderRadius:12}}><Icon name="close"/></button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
        {visibleActions.map((item)=><button key={item.id} type="button" onClick={()=>pick(item.id)} data-testid={`insert-${item.id}`} style={{minWidth:0,minHeight:82,display:'grid',gridTemplateRows:'28px auto',alignContent:'center',gap:7,textAlign:'left',padding:11,borderRadius:15,border:'1px solid var(--rs-line)',background:'var(--rs-surface-2)',color:'var(--rs-text)',cursor:'pointer'}}>
          <span style={{width:28,height:28,borderRadius:9,display:'grid',placeItems:'center',background:'var(--rs-surface)',color:item.id==='urgent'?'var(--rs-warn)':'var(--rs-cyan)'}}><Icon name={item.icon}/></span>
          <span style={{minWidth:0}}><strong style={{display:'block',fontFamily:'Sora',fontSize:'.78rem',lineHeight:1.15}}>{item.title}</strong><small style={{display:'block',marginTop:3,color:'var(--rs-text-3)',fontSize:'.62rem',lineHeight:1.25}}>{item.subtitle}</small></span>
        </button>)}
      </div>
    </section>
  </div>
}
