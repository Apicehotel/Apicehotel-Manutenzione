import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { buildColleaguePresenceRows, fetchPeopleInStructure } from '../home-presence.js'
import {
  buildMyWorkPreview,
  buildNextCommitment,
  syncStatusMessage,
  weatherSummary,
} from '../home-widgets-logic.js'
import { drainOfflineQueue, getOfflineStatus } from '../offline-store.js'
import { withTimeout } from '../async-timeout.js'
import { fetchReminders } from './reminders/reminder-data.js'
import { canUser } from '../permissions.js'
import { firstName, isToday, URGENCY_META } from './helpers.js'
import { Badge, Button, Card, EmptyState, Icon, Spinner } from './ui.jsx'
import RandAIPriorityCard from './RandAIPriorityCard.jsx'
import './home-operational.css'

const HOME_QUERY_TIMEOUT_MS = 15000
const timed = (promise, label) => withTimeout(promise, HOME_QUERY_TIMEOUT_MS, label)
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } } })
const FOCUS_KEY = 'randapp.home.focus.v1'
const readFocus = () => { try { return localStorage.getItem(FOCUS_KEY) !== 'complete' } catch { return true } }
const writeFocus = (focus) => { try { localStorage.setItem(FOCUS_KEY, focus ? 'focus' : 'complete') } catch {} }
const dateKey = (value = new Date()) => value.toISOString().slice(0, 10)
const weekdayKey = (date) => ['sun','mon','tue','wed','thu','fri','sat'][date.getDay()]
const monthDay = (date) => date.getDate()
const timeLabel = (ms) => ms ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) : ''

export function reminderDueToday(item, user, now = new Date()) {
  if (!item?.active || !(item.target_roles || []).includes(user?.role)) return false
  const today = dateKey(now)
  if (item.start_date && today < item.start_date) return false
  if (item.end_date && today > item.end_date) return false
  if (item.repeat_kind === 'once') return item.start_date === today
  if (item.repeat_kind === 'daily') return true
  if (item.repeat_kind === 'weekly') return (item.weekdays || []).includes(weekdayKey(now))
  if (item.repeat_kind === 'monthly') return Number(item.month_day || String(item.start_date || '').slice(8, 10)) === monthDay(now)
  return false
}

function roleLabel(user) {
  const role = user?.role || 'Utente'
  if (role === 'manutentore') return 'Manutenzione'
  if (role === 'Governante' || role === 'Capo Governante') return 'Housekeeping'
  return role
}

function deskDayLabel(now = new Date()) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(now)
}

export function buildPriorityItems({ user, openUrgents, openIssues, todayInterventions, reminders, weather }) {
  const rows = []
  if (canUser(user, 'urgent', 'view')) openUrgents.forEach((item) => rows.push({ id:`urgent-${item.id}`,score:100,tone:'high',icon:'warning',route:'urgent',eyebrow:'Allarme',title:item.message||item.title||item.location||'Richiesta urgente',meta:item.location||item.room||'Richiede attenzione immediata' }))
  if (weather?.level === 'danger' || weather?.level === 'warning') rows.push({ id:'weather',score:weather.level === 'danger' ? 96 : 82,tone:weather.level==='danger'?'high':'mid',icon:'thermometer',eyebrow:weather.level==='danger'?'Allarme meteo':'Attenzione meteo',title:weather.message||'Controllare gli esterni',meta:weather.level==='danger'?'Azione consigliata adesso':'Verifica preventiva' })
  if (canUser(user, 'issues', 'view')) openIssues.forEach((item) => rows.push({ id:`issue-${item.id}`,score:item.urgency === 'alta' ? 92 : item.urgency === 'media' ? 58 : 42,tone:URGENCY_META[item.urgency]?.tone||'mid',icon:'issues',route:'issues',eyebrow:'Segnalazione',title:item.title||'Segnalazione aperta',meta:item.room||'Da gestire',createdAt:item.createdAt }))
  if (canUser(user, 'reminders', 'view')) reminders.filter((item) => reminderDueToday(item,user)).forEach((item) => rows.push({ id:`reminder-${item.id}`,score:78,tone:'accent',icon:'bell',route:'reminders',eyebrow:'Promemoria',title:item.message||'Promemoria',meta:(item.times||[]).length?`Oggi · ${(item.times||[]).join(' · ')}`:'Oggi' }))
  if (canUser(user, 'interventions', 'view')) todayInterventions.forEach((item) => rows.push({ id:`planned-${item.id}`,score:item.scheduledAt&&item.scheduledAt<Date.now()?76:68,tone:'todo',icon:'wrench',route:'interventions',eyebrow:'Intervento oggi',title:item.notes||item.category||'Intervento pianificato',meta:[item.location,timeLabel(item.scheduledAt)].filter(Boolean).join(' · ')||'Pianificato oggi' }))
  return rows.sort((a, b) => b.score - a.score || (a.createdAt || 0) - (b.createdAt || 0))
}

function HomeData({ user, hotel, onNavigate, personalizeSignal }) {
  const queryClient = useQueryClient()
  const [focusOnly,setFocusOnly]=useState(readFocus)
  const [preferencesOpen,setPreferencesOpen]=useState(false)
  const [offlineStatus,setOfflineStatus]=useState(null)
  useEffect(()=>{ if(personalizeSignal>0) setPreferencesOpen(true) },[personalizeSignal])
  useEffect(()=>{
    let alive=true
    getOfflineStatus().then((status)=>{ if(alive) setOfflineStatus(status) }).catch(()=>{})
    const onStatus=(event)=>{ setOfflineStatus(event.detail||null) }
    window.addEventListener('apice-offline-status', onStatus)
    return ()=>{ alive=false; window.removeEventListener('apice-offline-status', onStatus) }
  },[])
  const canIssues = canUser(user, 'issues', 'view')
  const canCreateIssues = canUser(user, 'issues', 'create')
  const canUrgent = canUser(user, 'urgent', 'view')
  const canInterventions = canUser(user, 'interventions', 'view')
  const canReminders = canUser(user, 'reminders', 'view')
  const canInventory = canUser(user, 'inventory', 'view')
  const issuesQuery=useQuery({queryKey:['home13',hotel.id,'issues'],queryFn:()=>timed(fetchIssues(hotel.id),'Home issues timeout'),enabled:canIssues})
  const urgentsQuery=useQuery({queryKey:['home13',hotel.id,'urgents'],queryFn:()=>timed(fetchUrgents(hotel.id),'Home urgents timeout'),enabled:canUrgent})
  const plannedQuery=useQuery({queryKey:['home13',hotel.id,'planned'],queryFn:()=>timed(fetchPlanned(hotel.id),'Home planned timeout'),enabled:canInterventions})
  const remindersQuery=useQuery({queryKey:['home13',hotel.id,'reminders',user?.role],queryFn:()=>timed(fetchReminders(hotel.id),'Home reminders timeout'),enabled:canReminders})
  const weatherQuery=useQuery({queryKey:['home13',hotel.id,'weather'],queryFn:({signal})=>timed(fetchOperationalWeather(hotel.id,{signal}),'Home weather timeout'),refetchInterval:5*60_000})
  const presenceQuery=useQuery({queryKey:['home13',hotel.id,'presence'],queryFn:()=>timed(fetchPeopleInStructure(hotel.id),'Home presence timeout'),refetchInterval:60_000})
  useEffect(()=>{
    const refreshPresence=()=>{ queryClient.invalidateQueries({ queryKey:['home13',hotel.id,'presence'] }) }
    window.addEventListener('apice-presence-changed', refreshPresence)
    window.addEventListener('focus', refreshPresence)
    window.addEventListener('online', refreshPresence)
    return ()=>{
      window.removeEventListener('apice-presence-changed', refreshPresence)
      window.removeEventListener('focus', refreshPresence)
      window.removeEventListener('online', refreshPresence)
    }
  },[queryClient,hotel.id])
  const coreQueries=[
    canIssues && issuesQuery,
    canUrgent && urgentsQuery,
    canInterventions && plannedQuery,
    canReminders && remindersQuery,
  ].filter(Boolean)
  const loading=coreQueries.some((q)=>q.isLoading)
  const homeFailed=coreQueries.some((q)=>q.isError)
  const homeHardFail=homeFailed && !loading && coreQueries.every((q)=>q.isError && !q.data)
  const retryHome=()=>{
    queryClient.invalidateQueries({ queryKey:['home13',hotel.id] })
  }
  const issues=issuesQuery.data?.issues||[], urgents=urgentsQuery.data?.items||[], planned=plannedQuery.data?.items||[], reminders=remindersQuery.data||[]
  const openIssues=issues.filter((item)=>item.status!=='done'), openUrgents=urgents.filter((item)=>item.status!=='completata')
  const todayInterventions=planned.filter((item)=>item.status!=='done'&&(isToday(item.scheduledAt)||(item.scheduledAt&&item.scheduledUntil&&item.scheduledAt<=Date.now()&&item.scheduledUntil>=Date.now())))
  const weather=weatherQuery.data
  const weatherCard=weatherSummary(weather)
  const syncCard=syncStatusMessage(offlineStatus)
  const presenceRows=useMemo(()=>buildColleaguePresenceRows({
    people:presenceQuery.data?.people||[],
    urgents:canUrgent?openUrgents:[],
  }),[presenceQuery.data?.people,openUrgents,canUrgent])
  const busyCount=presenceRows.filter((row)=>row.busy).length
  const presenceOk=presenceQuery.data?.ok!==false
  const myWorkRows=useMemo(()=>buildMyWorkPreview({
    user,
    planned:canInterventions?planned:[],
    urgents:canUrgent?openUrgents:[],
  }),[user,planned,openUrgents,canInterventions,canUrgent])
  const nextCommitment=useMemo(()=>buildNextCommitment({
    user,
    planned:canInterventions?planned:[],
    reminders:canReminders?reminders:[],
    reminderDueToday,
  }),[user,planned,reminders,canInterventions,canReminders])
  const priorities=useMemo(()=>buildPriorityItems({user,openUrgents,openIssues,todayInterventions,reminders,weather}),[user,openUrgents,openIssues,todayInterventions,reminders,weather])
  const visiblePriorities=focusOnly?priorities.filter((item)=>item.score>=68).slice(0,4):priorities.slice(0,8)
  const dueReminders=reminders.filter((item)=>reminderDueToday(item,user)).length
  const stats=[canUrgent?{label:'Allarmi',value:openUrgents.length,route:'urgent',tone:openUrgents.length?'high':'done'}:null,canIssues?{label:'Da fare',value:openIssues.length,route:'issues',tone:openIssues.some((x)=>x.urgency==='alta')?'high':'todo'}:null,canInterventions?{label:'Oggi',value:todayInterventions.length,route:'interventions',tone:'accent'}:null,canReminders?{label:'Promemoria',value:dueReminders,route:'reminders',tone:'waiting'}:null].filter(Boolean)
  const tools=[
    canCreateIssues?['new-issue','plus','Nuova']:null,
    canInterventions?['my-work','check','Miei']:null,
    canInterventions?['interventions','wrench','Interventi']:null,
    canUrgent?['urgent','warning','Avvisi']:null,
    canUser(user, 'housekeeping', 'view')?['housekeeping','housekeeping','HK']:null,
    canInventory?['inventory','package','Magazzino']:null,
    canReminders?['reminders','bell','Memo']:null,
  ].filter(Boolean).slice(0,5)
  const setMode=(focus)=>{setFocusOnly(focus);writeFocus(focus)}
  const openPresenceTarget=()=>{ if(canUrgent) onNavigate?.('urgent') }
  const retrySync=()=>{ drainOfflineQueue().catch(()=>{}) }
  const showDesk=canInterventions||canUrgent||canIssues
  const presencePreview=presenceRows.slice(0,4)
  const presenceMore=Math.max(0, presenceRows.length - presencePreview.length)

  return <section className="rs-home rs-workhome rs-workhome--desk" data-testid="home-view">
    <header className="rs-workhome__hero">
      <div>
        <span className="rs-workhome__role">{roleLabel(user)} · Scrivania</span>
        <h1>Ciao, {firstName(user?.name)}</h1>
        <p>{hotel.name} · {deskDayLabel()} · il tuo banco operativo</p>
      </div>
      <div className="rs-workhome__hero-actions">
        {canCreateIssues&&<Button variant="ghost" size="sm" icon="plus" onClick={()=>onNavigate?.('new-issue')} aria-label="Nuova segnalazione"><span className="rs-workhome__create-label">Nuova</span></Button>}
        <Button variant="ghost" size="sm" icon="sliders" onClick={()=>setPreferencesOpen((v)=>!v)} aria-expanded={preferencesOpen} aria-label="Configura vista Home"><span className="rs-workhome__view-label">Vista</span></Button>
      </div>
    </header>
    {preferencesOpen&&<Card className="rs-card--pad rs-workhome__prefs"><div><strong>Vista Home</strong><small>La priorità resta automatica; puoi scegliere quanta informazione mostrare.</small></div><div className="rs-segmented" role="group" aria-label="Vista Home"><button type="button" className={focusOnly?'active':''} onClick={()=>setMode(true)}>Focus</button><button type="button" className={!focusOnly?'active':''} onClick={()=>setMode(false)}>Completa</button></div></Card>}
    {loading?<Spinner label="Preparo la scrivania…"/>:homeHardFail?(
      <div data-testid="home-hard-fail" style={{display:'grid',gap:16,justifyItems:'center',padding:'24px 12px'}}>
        <EmptyState icon="warning" title="Scrivania non disponibile">
          Non riesco a caricare i dati operativi. Controlla la connessione e riprova.
        </EmptyState>
        <Button type="button" variant="primary" size="sm" onClick={retryHome} data-testid="home-retry">Riprova</Button>
      </div>
    ):<>
      {homeFailed&&(
        <button type="button" className="rs-workhome__sync is-warn" onClick={retryHome} data-testid="home-partial-retry">
          <Icon name="warning"/><span><strong>Alcuni dati non sono aggiornati</strong><small>Tocca per riprovare il caricamento</small></span>
        </button>
      )}
      <div className="rs-workhome__stats rs-workhome__stats--strip" data-count={stats.length} data-testid="home-stats">{stats.map((stat)=><button key={stat.label} type="button" className="rs-workhome__stat" onClick={()=>onNavigate?.(stat.route)}><Badge tone={stat.tone}>{stat.label}</Badge><strong>{stat.value}</strong></button>)}</div>
      {syncCard&&<button type="button" className={`rs-workhome__sync is-${syncCard.tone}`} onClick={retrySync} data-testid="home-sync"><Icon name="refresh"/><span><strong>{syncCard.title}</strong><small>{syncCard.detail}</small></span></button>}

      {showDesk&&<div className="rs-workhome__desk" data-testid="home-desk">
        <div className="rs-workhome__desk-head">
          <div>
            <span>SUL BANCO</span>
            <h2>La tua scrivania</h2>
          </div>
          {weatherCard&&<div className={`rs-workhome__desk-meteo is-${weatherCard.level}`} data-testid="weather-widget" role="status">
            <Icon name={weatherCard.level==='ok'?'thermometer':'warning'}/>
            <small>{weatherCard.detail}</small>
          </div>}
        </div>

        <button
          type="button"
          className={`rs-workhome__desk-next${nextCommitment?'':' is-empty'}`}
          data-testid={nextCommitment?'home-next-commitment':'home-next-empty'}
          onClick={()=>nextCommitment&&onNavigate?.(nextCommitment.route)}
          disabled={!nextCommitment}
        >
          <span className="rs-workhome__desk-kicker">Prossimo</span>
          {nextCommitment?(
            <>
              <strong>{nextCommitment.title}</strong>
              <small>{nextCommitment.meta}</small>
            </>
          ):(
            <>
              <strong>Nessun impegno orario</strong>
              <small>Quando arriva un intervento o un memo, compare qui</small>
            </>
          )}
        </button>

        <div className="rs-workhome__desk-grid">
          <section className="rs-workhome__desk-pane" data-testid="home-my-work" aria-label="I tuoi lavori">
            <div className="rs-workhome__desk-panehead">
              <strong>I tuoi</strong>
              <small>{myWorkRows.length?`${myWorkRows.length} attivi`:'libero'}</small>
            </div>
            {!myWorkRows.length?(
              <p className="rs-workhome__desk-empty">
                {canIssues&&openIssues.length
                  ? `${openIssues.length} segnalazion${openIssues.length===1?'e':'i'} in struttura`
                  : 'Niente assegnato a te'}
              </p>
            ):(
              <ul className="rs-workhome__desk-list">
                {myWorkRows.map((row)=>(
                  <li key={row.id}>
                    <button type="button" onClick={()=>onNavigate?.(row.route)}>
                      <Icon name={row.kind==='urgent'?'warning':'wrench'}/>
                      <span>
                        <strong>{row.title}</strong>
                        <small>{row.meta}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rs-workhome__you-actions">
              {canInterventions&&<button type="button" className="rs-workhome__mywork-all" onClick={()=>onNavigate?.('my-work')}>Task</button>}
              {canIssues&&!myWorkRows.length&&openIssues.length>0&&<button type="button" className="rs-workhome__mywork-all" onClick={()=>onNavigate?.('issues')}>Segnalazioni</button>}
            </div>
          </section>

          <section className="rs-workhome__desk-pane" data-testid="home-presence" aria-label="Chi c'è in struttura">
            <div className="rs-workhome__desk-panehead">
              <strong>Team</strong>
              <small>{presenceQuery.isLoading?'…':`${presenceRows.length} · ${busyCount} impegnati`}</small>
            </div>
            {presenceQuery.isLoading?(
              <p className="rs-workhome__desk-empty">Controllo presenza…</p>
            ):!presenceOk&&!presenceRows.length?(
              <p className="rs-workhome__desk-empty">Presenza non aggiornata{presenceQuery.data?.offline?' (offline)':''}</p>
            ):!presenceRows.length?(
              <p className="rs-workhome__desk-empty">Nessuno in struttura</p>
            ):(
              <div className="rs-workhome__desk-team">
                {presencePreview.map((row)=>(
                  <button
                    key={row.id}
                    type="button"
                    className={`rs-workhome__desk-chip${row.busy?' is-busy':''}`}
                    onClick={openPresenceTarget}
                    disabled={!canUrgent}
                    aria-label={`${row.name}: ${row.busy?'impegnato':'libero'}`}
                  >
                    <span className="rs-workhome__colleague-dot" data-busy={row.busy?'true':'false'} aria-hidden="true"/>
                    <span>
                      <strong>{row.name.split(' ')[0]}</strong>
                      <small>{row.busy?'Impegnato':'Libero'}</small>
                    </span>
                  </button>
                ))}
                {presenceMore>0&&<span className="rs-workhome__desk-more">+{presenceMore}</span>}
              </div>
            )}
          </section>
        </div>
      </div>}

      {!!tools.length&&(
        <div className="rs-workhome__tools" data-testid="home-shortcuts">
          <div className="rs-workhome__sectionhead"><div><span>ATTREZZI</span><h2>A portata di mano</h2></div></div>
          <div className="rs-workhome__toolrow">
            {tools.map(([route,icon,label])=>(
              <button key={route} type="button" onClick={()=>onNavigate?.(route)}>
                <Icon name={icon}/>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rs-workhome__tray">
        <div className="rs-workhome__sectionhead"><div><span>VASSOIO</span><h2>Da smaltire</h2></div><small>{visiblePriorities.length} in coda</small></div>
        {visiblePriorities.length===0?<EmptyState icon="check" title="Vassoio vuoto">Niente urgente da smaltire adesso.</EmptyState>:<div className="rs-workhome__queue" data-testid="home-priority-queue">{visiblePriorities.map((item,index)=><button key={item.id} type="button" className={`rs-workhome__task tone-${item.tone}`} onClick={()=>item.route&&onNavigate?.(item.route)} disabled={!item.route}><span className="rs-workhome__rank">{index+1}</span><span className="rs-workhome__taskicon"><Icon name={item.icon}/></span><span className="rs-workhome__taskbody"><small>{item.eyebrow}</small><strong>{item.title}</strong><span>{item.meta}</span></span>{item.route&&<Icon name="chevronRight"/>}</button>)}</div>}
        {canIssues&&<RandAIPriorityCard hotel={hotel} user={user} onNavigate={onNavigate}/>}
      </div>
    </>}
  </section>
}

export default function Home(props){return <QueryClientProvider client={queryClient}><HomeData {...props}/></QueryClientProvider>}
