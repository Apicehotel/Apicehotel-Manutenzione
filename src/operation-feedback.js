const EVENT='apice-operation-feedback'

export function emitOperationFeedback(type,message,detail=''){
  if(typeof window==='undefined')return
  window.dispatchEvent(new CustomEvent(EVENT,{detail:{type,message,detail,at:Date.now()}}))
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

function showToast({type='info',message='',detail=''}){
  if(!message||typeof document==='undefined')return
  const host=ensureHost()
  const toast=document.createElement('div')
  toast.className=`operation-toast ${type}`
  toast.innerHTML=`<span class="operation-toast-icon" aria-hidden="true">${type==='success'?'✓':type==='queued'?'↻':type==='error'?'!':'i'}</span><span class="operation-toast-copy"><strong></strong>${detail?'<small></small>':''}</span><button type="button" aria-label="Chiudi">×</button>`
  toast.querySelector('strong').textContent=message
  const small=toast.querySelector('small');if(small)small.textContent=detail
  const close=()=>{toast.classList.add('leaving');setTimeout(()=>toast.remove(),180)}
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
