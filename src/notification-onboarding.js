import { getPushSubscriptionState, getPushSupportInfo, repairPushSubscription, subscribeToPush } from './push.js'

const SESSION_KEY='apicehotel.session.v1'
const ID='randapp-notification-onboarding'
const DISMISS_PREFIX='randapp.notification-onboarding.dismissed.v1'
let hotelId=null
let busy=false

const currentHotelId=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')?.hotelId||null}catch{return null}}
const dismissalKey=(id)=>`${DISMISS_PREFIX}:${id||'unknown'}`
const dismissed=(id)=>{try{return sessionStorage.getItem(dismissalKey(id))==='1'}catch{return false}}
const dismiss=(id)=>{try{sessionStorage.setItem(dismissalKey(id),'1')}catch{};remove()}
const remove=()=>document.getElementById(ID)?.remove()

function ensureBanner(){
  let el=document.getElementById(ID)
  if(el)return el
  el=document.createElement('aside')
  el.id=ID
  el.className='rs-notification-onboarding'
  el.setAttribute('role','status')
  el.innerHTML='<span class="rs-notification-onboarding__icon" aria-hidden="true">🔔</span><span class="rs-notification-onboarding__copy"><b>Attiva le notifiche</b><small>Servono per ricevere interventi assegnati, avvisi e promemoria.</small></span><button type="button" class="rs-notification-onboarding__close" aria-label="Chiudi avviso notifiche">×</button><button type="button" class="rs-notification-onboarding__action">Attiva</button>'
  const app=document.querySelector('.rs-app')||document.body
  app.appendChild(el)
  el.querySelector('.rs-notification-onboarding__close')?.addEventListener('click',()=>dismiss(hotelId||currentHotelId()))
  el.querySelector('.rs-notification-onboarding__action')?.addEventListener('click',async()=>{
    if(busy)return
    busy=true
    const button=el.querySelector('.rs-notification-onboarding__action')
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
  if(!hotelId||dismissed(hotelId)){remove();return}
  const info=getPushSupportInfo()
  if(info.requiresHomeScreen){
    const el=ensureBanner(),copy=el.querySelector('.rs-notification-onboarding__copy small'),button=el.querySelector('.rs-notification-onboarding__action')
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
  const el=ensureBanner(),copy=el.querySelector('.rs-notification-onboarding__copy small'),button=el.querySelector('.rs-notification-onboarding__action')
  if(state==='denied'){
    if(copy)copy.textContent='Le notifiche sono bloccate dal dispositivo. Riabilitale nelle impostazioni di RandApp/browser.'
    if(button){button.hidden=true}
    return
  }
  if(copy)copy.textContent='Ricevi subito gli interventi assegnati, oltre ad avvisi e promemoria.'
  if(button){button.hidden=false;button.disabled=false;button.textContent='Attiva'}
}

function clearAssignmentParams(){
  const next=new URL(window.location.href)
  next.searchParams.delete('notification')
  next.searchParams.delete('hotel_id')
  next.searchParams.delete('intervention_id')
  history.replaceState({},'',`${next.pathname}${next.search}${next.hash}`)
}

function routeAssignmentIntent(rawUrl=window.location.href,attempt=0){
  let parsed
  try{parsed=new URL(rawUrl,window.location.origin)}catch{return false}
  if(parsed.searchParams.get('notification')!=='assignment')return false
  const targetHotel=parsed.searchParams.get('hotel_id')
  const activeHotel=currentHotelId()

  if(targetHotel&&activeHotel&&targetHotel!==activeHotel){
    const targetButton=document.querySelector(`[data-testid="switch-hotel-${targetHotel}"]`)
    if(targetButton){targetButton.click();window.setTimeout(()=>routeAssignmentIntent(rawUrl,attempt+1),650);return true}
    const chip=document.querySelector('[data-testid="hotel-chip"]')
    if(chip){chip.click();window.setTimeout(()=>routeAssignmentIntent(rawUrl,attempt+1),180);return true}
  }

  const direct=document.querySelector('[data-testid="nav-interventions"], [data-testid="sidebar-interventions"], [data-testid="drawer-interventions"]')
  if(direct){direct.click();clearAssignmentParams();return true}
  const menu=document.querySelector('[data-testid="nav-menu"]')
  if(menu){menu.click();window.setTimeout(()=>routeAssignmentIntent(rawUrl,attempt+1),180);return true}
  if(attempt<12){window.setTimeout(()=>routeAssignmentIntent(rawUrl,attempt+1),250);return true}
  return false
}

export function initNotificationOnboarding(){
  const run=(id)=>window.setTimeout(()=>refresh(id).catch(()=>{}),500)
  window.addEventListener('apice-session-changed',(event)=>{run(event.detail?.hotelId);window.setTimeout(()=>routeAssignmentIntent(),700)})
  window.addEventListener('focus',()=>run(currentHotelId()))
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run(currentHotelId())})
  navigator.serviceWorker?.addEventListener('message',(event)=>{if(event.data?.type==='notification-click')routeAssignmentIntent(event.data?.url||window.location.href)})
  window.addEventListener('load',()=>{run(currentHotelId());window.setTimeout(()=>routeAssignmentIntent(),650)},{once:true})
}
