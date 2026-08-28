import { getPushSubscriptionState, getPushSupportInfo, repairPushSubscription, subscribeToPush } from './push.js'

const SESSION_KEY='apicehotel.session.v1'
const ID='randapp-notification-onboarding'
let hotelId=null
let busy=false

const currentHotelId=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')?.hotelId||null}catch{return null}}
const remove=()=>document.getElementById(ID)?.remove()

function ensureBanner(){
  let el=document.getElementById(ID)
  if(el)return el
  el=document.createElement('aside')
  el.id=ID
  el.className='rs-notification-onboarding'
  el.setAttribute('role','status')
  el.innerHTML='<span class="rs-notification-onboarding__icon" aria-hidden="true">🔔</span><span class="rs-notification-onboarding__copy"><b>Attiva le notifiche</b><small>Servono per ricevere interventi assegnati, avvisi e promemoria.</small></span><button type="button" class="rs-notification-onboarding__action">Attiva</button>'
  const app=document.querySelector('.rs-app')||document.body
  app.appendChild(el)
  el.querySelector('button')?.addEventListener('click',async()=>{
    if(busy)return
    busy=true
    const button=el.querySelector('button')
    if(button){button.disabled=true;button.textContent='Attivo…'}
    try{
      const target=hotelId||currentHotelId()
      await subscribeToPush(target)
      await refresh(target)
    }catch(error){
      const copy=el.querySelector('.rs-notification-onboarding__copy small')
      if(copy)copy.textContent=error?.message||'Attivazione non riuscita. Riprova.'
      if(button){button.disabled=false;button.textContent='Riprova'}
    }finally{busy=false}
  })
  return el
}

async function refresh(nextHotelId=currentHotelId()){
  hotelId=nextHotelId||currentHotelId()
  if(!hotelId){remove();return}
  const info=getPushSupportInfo()
  if(info.requiresHomeScreen){
    const el=ensureBanner(),copy=el.querySelector('.rs-notification-onboarding__copy small'),button=el.querySelector('button')
    if(copy)copy.textContent='Su iPhone aggiungi RandApp alla schermata Home e aprila da lì per ricevere le notifiche.'
    if(button){button.hidden=true}
    return
  }
  if(!info.supported){remove();return}
  if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
    await repairPushSubscription(hotelId).catch(()=>false)
  }
  const state=await getPushSubscriptionState(hotelId)
  if(state==='subscribed'){remove();return}
  const el=ensureBanner(),copy=el.querySelector('.rs-notification-onboarding__copy small'),button=el.querySelector('button')
  if(state==='denied'){
    if(copy)copy.textContent='Le notifiche sono bloccate dal dispositivo. Riabilitale nelle impostazioni di RandApp/browser.'
    if(button){button.hidden=true}
    return
  }
  if(copy)copy.textContent='Ricevi subito gli interventi assegnati, oltre ad avvisi e promemoria.'
  if(button){button.hidden=false;button.disabled=false;button.textContent='Attiva'}
}

export function initNotificationOnboarding(){
  const run=(id)=>window.setTimeout(()=>refresh(id).catch(()=>{}),500)
  window.addEventListener('apice-session-changed',(event)=>run(event.detail?.hotelId))
  window.addEventListener('focus',()=>run(currentHotelId()))
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run(currentHotelId())})
  window.addEventListener('load',()=>run(currentHotelId()),{once:true})
}
