const EVENT='apice-operation-feedback'
const TOAST_DEDUPE_MS=5000
const MAX_VISIBLE_TOASTS=3

function sharedState(){
  if(typeof window==='undefined')return{recent:new Map(),installed:false,previousPending:0}
  if(!window.__apiceOperationFeedbackState){
    window.__apiceOperationFeedbackState={recent:new Map(),installed:false,previousPending:0}
  }
  return window.__apiceOperationFeedbackState
}

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

function normalized(value=''){
  return String(value||'').trim().replace(/\s+/g,' ').toLowerCase()
}

function toastKey({type='info',message='',detail=''}){
  return `${type}|${normalized(message)}|${normalized(detail)}`
}

function cleanupRecent(now=Date.now()){
  const recent=sharedState().recent
  for(const[key,expires]of recent.entries())if(expires<=now)recent.delete(key)
}

function showToast({type='info',message='',detail=''}){
  if(!message||typeof document==='undefined')return
  const state=sharedState()
  const now=Date.now();cleanupRecent(now)
  const key=toastKey({type,message,detail})
  if(state.recent.has(key))return
  state.recent.set(key,now+TOAST_DEDUPE_MS)

  const host=ensureHost()
  const normalizedMessage=normalized(message)
  const normalizedDetail=normalized(detail)
  const existing=[...host.querySelectorAll('.operation-toast:not(.leaving)')].find((node)=>{
    const m=normalized(node.querySelector('strong')?.textContent)
    const d=normalized(node.querySelector('small')?.textContent)
    return m===normalizedMessage&&(d===normalizedDetail||!normalizedDetail||!d)
  })
  if(existing)return

  const visible=[...host.querySelectorAll('.operation-toast:not(.leaving)')]
  while(visible.length>=MAX_VISIBLE_TOASTS){const oldest=visible.shift();oldest?.remove()}

  const cleanDetail=normalizedDetail===normalizedMessage?'':detail
  const toast=document.createElement('div')
  toast.className=`operation-toast ${type}`
  toast.innerHTML=`<span class="operation-toast-icon" aria-hidden="true">${type==='success'?'✓':type==='queued'?'↻':type==='error'?'!':'i'}</span><span class="operation-toast-copy"><strong></strong>${cleanDetail?'<small></small>':''}</span><button type="button" aria-label="Chiudi">×</button>`
  toast.querySelector('strong').textContent=message
  const small=toast.querySelector('small');if(small)small.textContent=cleanDetail
  let closed=false
  const close=()=>{if(closed)return;closed=true;toast.classList.add('leaving');setTimeout(()=>toast.remove(),180)}
  toast.querySelector('button').addEventListener('click',close)
  host.appendChild(toast)
  requestAnimationFrame(()=>toast.classList.add('visible'))
  setTimeout(close,type==='error'?6500:3200)
}

function installListeners(){
  if(typeof window==='undefined')return
  const state=sharedState()
  if(state.installed)return
  state.installed=true

  window.addEventListener(EVENT,(event)=>showToast(event.detail||{}))
  window.addEventListener('apice-offline-status',(event)=>{
    const pending=Number(event.detail?.pending||0)
    const online=event.detail?.online!==false
    if(pending>state.previousPending)showToast({type:'queued',message:'Salvato sul dispositivo',detail:`${pending} modifica${pending===1?'':'he'} da sincronizzare`})
    if(online&&state.previousPending>0&&pending===0)showToast({type:'success',message:'Sincronizzazione completata'})
    state.previousPending=pending
  })
  window.addEventListener('unhandledrejection',(event)=>{
    const error=event.reason
    const message=error?.message||String(error||'Errore imprevisto')
    if(/network|failed to fetch|load failed|timeout|connection/i.test(message))return
    // Gli errori applicativi già notificati tramite operationFailed non devono
    // generare un secondo toast tramite il listener globale.
    const recent=[...state.recent.keys()]
    if(recent.some((key)=>key.includes(normalized(message))))return
    showToast({type:'error',message:'Operazione non riuscita',detail:message})
  })
  window.addEventListener('error',(event)=>{
    if(!event?.message)return
    showToast({type:'error',message:'Si è verificato un errore',detail:event.message})
  })
}

installListeners()
