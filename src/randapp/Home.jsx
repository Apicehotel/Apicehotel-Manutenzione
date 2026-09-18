import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { fetchReminders } from './reminders/reminder-data.js'
import { fetchPlanningWork } from '../planning-work-data.js'
import { fetchBookings } from '../sale-data.js'
import { canUser } from '../permissions.js'
import { firstName, isToday, URGENCY_META } from './helpers.js'
import { Badge, Button, Card, EmptyState, Icon, Spinner } from './ui.jsx'
import RandAIPriorityCard from './RandAIPriorityCard.jsx'
import './home-operational.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } } })
const FOCUS_KEY = 'randapp.home.focus.v1'
const readFocus = () => { try { return localStorage.getItem(FOCUS_KEY) !== 'complete' } catch { return true } }
const writeFocus = (focus) => { try { localStorage.setItem(FOCUS_KEY, focus ? 'focus' : 'complete') } catch {} }
const dateKey = (value = new Date()) => value.toISOString().slice(0, 10)
const weekdayKey = (date) => ['sun','mon','tue','wed','thu','fri','sat'][date.getDay()]
const monthDay = (date) => date.getDate()
const timeLabel = (ms) => ms ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) : ''

function reminderDueToday(item, user, now = new Date()) {
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

export function buildPriorityItems({ user, openUrgents, openIssues, todayInterventions, reminders, weather }) {
  const rows = []
  if (canUser(user, 'urgent', 'view')) openUrgents.forEach((item) => rows.push({ id:`urgent-${item.id}`,score:100,tone:'high',icon:'warning',route:'urgent',eyebrow:'Allarme',title:item.message||item.title||item.location||'Richiesta urgente',meta:item.location||item.room||'Richiede attenzione immediata' }))
  if (weather?.level === 'danger' || weather?.level === 'warning') rows.push({ id:'weather',score:weather.level === 'danger' ? 96 : 82,tone:weather.level==='danger'?'high':'mid',icon:'thermometer',eyebrow:weather.level==='danger'?'Allarme meteo':'Attenzione meteo',title:weather.message||'Controllare gli esterni',meta:weather.level==='danger'?'Azione consigliata adesso':'Verifica preventiva' })
  if (canUser(user, 'issues', 'view')) openIssues.forEach((item) => rows.push({ id:`issue-${item.id}`,score:item.urgency === 'alta' ? 92 : item.urgency === 'media' ? 58 : 42,tone:URGENCY_META[item.urgency]?.tone||'mid',icon:'issues',route:'issues',itemId:item.id,eyebrow:'Segnalazione',title:item.title||'Segnalazione aperta',meta:item.room||'Da gestire',createdAt:item.createdAt }))
  if (canUser(user, 'reminders', 'view')) reminders.filter((item) => reminderDueToday(item,user)).forEach((item) => rows.push({ id:`reminder-${item.id}`,score:78,tone:'accent',icon:'bell',route:'reminders',eyebrow:'Promemoria',title:item.message||'Promemoria',meta:(item.times||[]).length?`Oggi · ${(item.times||[]).join(' · ')}`:'Oggi' }))
  if (canUser(user, 'interventions', 'view')) todayInterventions.forEach((item) => rows.push({ id:`planned-${item.id}`,score:item.scheduledAt&&item.scheduledAt<Date.now()?76:68,tone:'todo',icon:'wrench',route:'interventions',itemId:item.id,eyebrow:'Intervento oggi',title:item.notes||item.category||'Intervento pianificato',meta:[item.location,timeLabel(item.scheduledAt)].filter(Boolean).join(' · ')||'Pianificato oggi' }))
  return rows.sort((a, b) => b.score - a.score || (a.createdAt || 0) - (b.createdAt || 0))
}

function HomeData({ user, hotel, onNavigate, personalizeSignal }) {
  const [focusOnly,setFocusOnly]=useState(readFocus)
  const [preferencesOpen,setPreferencesOpen]=useState(false)
  useEffect(()=>{ if(personalizeSignal>0) setPreferencesOpen(true) },[personalizeSignal])
  const canIssues = canUser(user, 'issues', 'view')
  const canCreateIssues = canUser(user, 'issues', 'create')
  const canUrgent = canUser(user, 'urgent', 'view')
  const canInterventions = canUser(user, 'interventions', 'view')
  const canReminders = canUser(user, 'reminders', 'view')
  const canPlanningWork = canUser(user, 'planning_work', 'view')
  const canPlanningSale = canUser(user, 'planning_sale', 'view')
  const issuesQuery=useQuery({queryKey:['home13',hotel.id,'issues'],queryFn:()=>fetchIssues(hotel.id),enabled:canIssues})
  const urgentsQuery=useQuery({queryKey:['home13',hotel.id,'urgents'],queryFn:()=>fetchUrgents(hotel.id),enabled:canUrgent})
  const plannedQuery=useQuery({queryKey:['home13',hotel.id,'planned'],queryFn:()=>fetchPlanned(hotel.id),enabled:canInterventions})
  const remindersQuery=useQuery({queryKey:['home13',hotel.id,'reminders',user?.role],queryFn:()=>fetchReminders(hotel.id),enabled:canReminders})
  const planningWorkQuery=useQuery({queryKey:['home13',hotel.id,'planning-work'],queryFn:()=>fetchPlanningWork(hotel.id),enabled:canPlanningWork})
  const planningSaleQuery=useQuery({queryKey:['home13',hotel.id,'planning-sale'],queryFn:()=>fetchBookings(hotel.id),enabled:canPlanningSale})
  const weatherQuery=useQuery({queryKey:['home13',hotel.id,'weather'],queryFn:({signal})=>fetchOperationalWeather(hotel.id,{signal}),refetchInterval:5*60_000})
  const loading=[issuesQuery,urgentsQuery,plannedQuery,remindersQuery].some((q)=>q.isPending&&q.fetchStatus!=='idle')
  const issues=issuesQuery.data?.issues||[], urgents=urgentsQuery.data?.items||[], planned=plannedQuery.data?.items||[], reminders=remindersQuery.data||[]
  const planningWork=planningWorkQuery.data||[], planningSales=planningSaleQuery.data?.items||[]
  const openIssues=issues.filter((item)=>item.status!=='done'), openUrgents=urgents.filter((item)=>item.status!=='completata')
  const todayInterventions=planned.filter((item)=>item.status!=='done'&&(isToday(item.scheduledAt)||(item.scheduledAt&&item.scheduledUntil&&item.scheduledAt<=Date.now()&&item.scheduledUntil>=Date.now())))
  const weather=weatherQuery.data
  const priorities=useMemo(()=>buildPriorityItems({user,openUrgents,openIssues,todayInterventions,reminders,weather}),[user,openUrgents,openIssues,todayInterventions,reminders,weather])
  const visiblePriorities=focusOnly?priorities.filter((item)=>item.score>=68).slice(0,7):priorities.slice(0,10)
  const dueReminders=reminders.filter((item)=>reminderDueToday(item,user)).length
  const today=dateKey()
  const todayPlanningWork=planningWork.filter((item)=>item.date===today)
  const todaySales=planningSales.filter((item)=>{const from=item.dateFrom||item.date;const to=item.dateTo||item.date;return from<=today&&to>=today})
  const highIssues=openIssues.filter((item)=>item.urgency==='alta').length
  const waitingIssues=openIssues.filter((item)=>item.status==='waiting'||item.status==='tecnico').length
  const structureWidgets=[
    canIssues?{icon:'issues',label:'Segnalazioni aperte',value:openIssues.length,meta:highIssues?`${highIssues} ad alta urgenza`:'Nessuna alta urgenza',tone:highIssues?'danger':'info'}:null,
    canInterventions?{icon:'wrench',label:'Interventi oggi',value:todayInterventions.length,meta:`${planned.filter(x=>x.status!=='done').length} ancora aperti`,tone:'success'}:null,
    canUrgent?{icon:'warning',label:'Avvisi attivi',value:openUrgents.length,meta:openUrgents.length?'Richiedono attenzione':'Tutto regolare',tone:openUrgents.length?'warning':'success'}:null,
    canReminders?{icon:'bell',label:'Promemoria oggi',value:dueReminders,meta:dueReminders?'Previsti oggi':'Nessuno per oggi',tone:'info'}:null,
    canPlanningWork?{icon:'calendar',label:'Lavori planning',value:todayPlanningWork.length,meta:'Attività previste oggi',tone:'info'}:null,
    canPlanningSale?{icon:'calendar',label:'Sale occupate',value:todaySales.length,meta:'Eventi in corso oggi',tone:'success'}:null,
  ].filter(Boolean)
  const stats=[canUrgent?{label:'Allarmi',value:openUrgents.length,route:'urgent',tone:openUrgents.length?'high':'done'}:null,canIssues?{label:'Da fare',value:openIssues.length,route:'issues',tone:openIssues.some((x)=>x.urgency==='alta')?'high':'todo'}:null,canInterventions?{label:'Oggi',value:todayInterventions.length,route:'interventions',tone:'accent'}:null,canReminders?{label:'Promemoria',value:dueReminders,route:'reminders',tone:'waiting'}:null].filter(Boolean)
  const quick=[canCreateIssues?['new-issue','plus','Nuova segnalazione']:null,canInterventions?['interventions','wrench','Interventi']:null,canUser(user, 'housekeeping', 'view')?['housekeeping','housekeeping','Housekeeping']:null,canReminders?['reminders','bell','Promemoria']:null].filter(Boolean).slice(0,4)
  const setMode=(focus)=>{setFocusOnly(focus);writeFocus(focus)}

  return <section className="rs-workhome" data-testid="home-view">
    <header className="rs-workhome__hero">
      <div><span className="rs-workhome__role">{roleLabel(user)}</span><h1>Ciao, {firstName(user?.name)}</h1><p>{hotel.name} · cosa richiede attenzione adesso</p></div>
      <div className="rs-workhome__hero-actions">
        {canCreateIssues&&<Button variant="ghost" size="sm" icon="plus" onClick={()=>onNavigate?.('new-issue')} aria-label="Nuova segnalazione"><span className="rs-workhome__create-label">Nuova</span></Button>}
        <Button variant="ghost" size="sm" icon="sliders" onClick={()=>setPreferencesOpen((v)=>!v)} aria-expanded={preferencesOpen} aria-label="Configura vista Home"><span className="rs-workhome__view-label">Vista</span></Button>
      </div>
    </header>
    {preferencesOpen&&<Card className="rs-card--pad rs-workhome__prefs"><div><strong>Vista Home</strong><small>La priorità resta automatica; puoi scegliere quanta informazione mostrare.</small></div><div className="rs-segmented" role="group" aria-label="Vista Home"><button type="button" className={focusOnly?'active':''} onClick={()=>setMode(true)}>Focus</button><button type="button" className={!focusOnly?'active':''} onClick={()=>setMode(false)}>Completa</button></div></Card>}
    {loading?<Spinner label="Preparo le priorità della giornata…"/>:<>
      <div className="rs-workhome__stats" data-count={stats.length} data-testid="home-stats">{stats.map((stat)=><button key={stat.label} type="button" className="rs-workhome__stat" onClick={()=>onNavigate?.(stat.route)}><Badge tone={stat.tone}>{stat.label}</Badge><strong>{stat.value}</strong></button>)}</div>
      <div className="rs-workhome__sectionhead"><div><span>STRUTTURA</span><h2>Quadro generale</h2></div><small>Aggiornato in tempo reale</small></div>
      <div className="rs-workhome__widgetgrid" data-testid="home-structure-widgets">{structureWidgets.map((widget)=><article key={widget.label} className={`rs-workhome__widget tone-${widget.tone}`}><span className="rs-workhome__widgeticon"><Icon name={widget.icon}/></span><div><small>{widget.label}</small><strong>{widget.value}</strong><span>{widget.meta}</span></div></article>)}</div>
      {weather&&<article className={`rs-workhome__weather is-${weather.level||'info'}`} data-testid="weather-widget"><Icon name={weather.level==='danger'||weather.level==='warning'?'warning':'thermometer'}/><span><strong>{weather.level==='danger'?'Allarme meteo':weather.level==='warning'?'Attenzione meteo':'Meteo struttura'}</strong><small>{weather.message||'Condizioni operative regolari'}</small></span></article>}
      <div className="rs-workhome__sectionhead"><div><span>PRIORITÀ</span><h2>Cosa fare adesso</h2></div><small>{visiblePriorities.length} attività rilevanti</small></div>
      {visiblePriorities.length===0?<EmptyState icon="check" title="Nessuna priorità immediata">Non risultano attività urgenti o pianificate per adesso.</EmptyState>:<div className="rs-workhome__queue">{visiblePriorities.map((item,index)=><button key={item.id} type="button" className={`rs-workhome__task tone-${item.tone}`} onClick={()=>item.route&&onNavigate?.(item.itemId?{view:item.route,itemId:item.itemId}:item.route)} disabled={!item.route}><span className="rs-workhome__rank">{index+1}</span><span className="rs-workhome__taskicon"><Icon name={item.icon}/></span><span className="rs-workhome__taskbody"><small>{item.eyebrow}</small><strong>{item.title}</strong><span>{item.meta}</span></span>{item.route&&<Icon name="chevronRight"/>}</button>)}</div>}
      {canIssues&&<RandAIPriorityCard hotel={hotel} user={user} onNavigate={onNavigate}/>} 
      {!focusOnly&&<><div className="rs-workhome__sectionhead"><div><span>ACCESSO RAPIDO</span><h2>Strumenti</h2></div></div><div className="rs-workhome__quick">{quick.map(([route,icon,label])=><button key={route} type="button" onClick={()=>onNavigate?.(route)}><Icon name={icon}/><span>{label}</span><Icon name="chevronRight"/></button>)}</div></>}
    </>}
  </section>
}

export default function Home(props){return <QueryClientProvider client={queryClient}><HomeData {...props}/></QueryClientProvider>}
