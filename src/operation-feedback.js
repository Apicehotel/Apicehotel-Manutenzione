const EVENT='apice-operation-feedback'
const TOAST_DEDUPE_MS=3500
const MAX_VISIBLE_TOASTS=3
const recentToasts=new Map()

export function emitOperationFeedback(type,message,detail=''){
  if(typeof window==='undefined')return
  window.dispatchEvent(new CustomEvent(EVENT,{detail:{type,message,detail,at:Date.now()}}))
}

export const operationSaved=(message='Salvato')=>emitOperationFeedback('success',message)
export const operationFailed=(error,message='Operazione non riuscita')=>{
  const detail=error?.message||String(error||'Errore imprevisto')
  emitOperationFeedback('error',message,detail)
}

function ensureHost(){
  let host=document.querySelector('.operation-feedback-host')
  if(host)return host
  host=document.createElement('div')
  host.className='operation-feedback-host'
  host.setAttribute('aria-live','polite')
  host.setAttribute('aria-atomic','true')
  document.body.appendChild(host)
  return host
}

function toastKey({type='info',message='',detail=''}){
  return `${type}|${String(message).trim()}|${String(detail).trim()}`
}

function cleanupRecent(now=Date.now()){
  for(const[key,expires]of recentToasts.entries())if(expires<=now)recentToasts.delete(key)
}

function showToast({type='info',message='',detail=''}){
  if(!message||typeof document==='undefined')return
  const now=Date.now();cleanupRecent(now)
  const key=toastKey({type,message,detail})
  if(recentToasts.has(key))return
  recentToasts.set(key,now+TOAST_DEDUPE_MS)

  const host=ensureHost()
  const visible=[...host.querySelectorAll('.operation-toast:not(.leaving)')]
  while(visible.length>=MAX_VISIBLE_TOASTS){const oldest=visible.shift();oldest?.remove()}

  const normalizedDetail=String(detail||'').trim()===String(message||'').trim()?'':detail
  const toast=document.createElement('div')
  toast.className=`operation-toast ${type}`
  toast.innerHTML=`<span class="operation-toast-icon" aria-hidden="true">${type==='success'?'✓':type==='queued'?'↻':type==='error'?'!':'i'}</span><span class="operation-toast-copy"><strong></strong>${normalizedDetail?'<small></small>':''}</span><button type="button" aria-label="Chiudi">×</button>`
  toast.querySelector('strong').textContent=message
  const small=toast.querySelector('small');if(small)small.textContent=normalizedDetail
  let closed=false
  const close=()=>{if(closed)return;closed=true;toast.classList.add('leaving');setTimeout(()=>toast.remove(),180)}
  toast.querySelector('button').addEventListener('click',close)
  host.appendChild(toast)
  requestAnimationFrame(()=>toast.classList.add('visible'))
  setTimeout(close,type==='error'?6500:3200)
}

if(typeof window!=='undefined'){
  window.addEventListener(EVENT,(event)=>showToast(event.detail||{}))
  let previousPending=0
  window.addEventListener('apice-offline-status',(event)=>{
    const pending=Number(event.detail?.pending||0)
    const online=event.detail?.online!==false
    if(pending>previousPending)showToast({type:'queued',message:'Salvato sul dispositivo',detail:`${pending} modifica${pending===1?'':'he'} da sincronizzare`})
    if(online&&previousPending>0&&pending===0)showToast({type:'success',message:'Sincronizzazione completata'})
    previousPending=pending
  })
  window.addEventListener('unhandledrejection',(event)=>{
    const error=event.reason
    const message=error?.message||String(error||'Errore imprevisto')
    if(/network|failed to fetch|load failed|timeout|connection/i.test(message)) return
    showToast({type:'error',message:'Operazione non riuscita',detail:message})
  })
  window.addEventListener('error',(event)=>{
    if(!event?.message)return
    showToast({type:'error',message:'Si è verificato un errore',detail:event.message})
  })
}
