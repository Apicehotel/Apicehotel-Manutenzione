import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { fetchReminders } from './reminders/reminder-data.js'
import { canUser } from '../permissions.js'
import { firstName, isToday, URGENCY_META } from './helpers.js'
import { Badge, Button, EmptyState, Icon, Spinner } from './ui.jsx'
import { loadUiSize } from './ui-size.js'
import { resolveHomeDashboardLayout } from './home-dashboard-layout.js'
import RandAIPriorityCard from './RandAIPriorityCard.jsx'
import './home-operational.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } } })
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
  if (canUser(user, 'issues', 'view')) openIssues.forEach((item) => rows.push({ id:`issue-${item.id}`,score:item.urgency === 'alta' ? 92 : item.urgency === 'media' ? 58 : 42,tone:URGENCY_META[item.urgency]?.tone||'mid',icon:'issues',route:'issues',eyebrow:'Segnalazione',title:item.title||'Segnalazione aperta',meta:item.room||'Da gestire',createdAt:item.createdAt }))
  if (canUser(user, 'reminders', 'view')) reminders.filter((item) => reminderDueToday(item,user)).forEach((item) => rows.push({ id:`reminder-${item.id}`,score:78,tone:'accent',icon:'bell',route:'reminders',eyebrow:'Promemoria',title:item.message||'Promemoria',meta:(item.times||[]).length?`Oggi · ${(item.times||[]).join(' · ')}`:'Oggi' }))
  if (canUser(user, 'interventions', 'view')) todayInterventions.forEach((item) => rows.push({ id:`planned-${item.id}`,score:item.scheduledAt&&item.scheduledAt<Date.now()?76:68,tone:'todo',icon:'wrench',route:'interventions',eyebrow:'Intervento oggi',title:item.notes||item.category||'Intervento pianificato',meta:[item.location,timeLabel(item.scheduledAt)].filter(Boolean).join(' · ')||'Pianificato oggi' }))
  return rows.sort((a, b) => b.score - a.score || (a.createdAt || 0) - (b.createdAt || 0))
}

function MacroCard({ id, title, eyebrow, layout, children, onOpen }) {
  const item = layout.find((entry) => entry.id === id)
  if (!item) return null
  return <section className="rs-homecard" data-card={id} data-span={item.span} data-layout-state={item.state}>
    <header className="rs-homecard__head"><div><span>{eyebrow}</span><h2>{title}</h2></div>{onOpen&&<button type="button" onClick={onOpen} aria-label={`Apri ${title}`}><Icon name="chevronRight"/></button>}</header>
    <div className="rs-homecard__body">{children}</div>
  </section>
}

function Metric({ label, value, tone = 'default', onClick }) {
  return <button type="button" className="rs-homecard__metric" onClick={onClick} disabled={!onClick}><Badge tone={tone}>{label}</Badge><strong>{value}</strong></button>
}

function HomeData({ user, hotel, onNavigate }) {
  const [uiSize, setUiSizeState] = useState(loadUiSize)
  useEffect(() => {
    const onSize = (event) => setUiSizeState(event.detail?.value || loadUiSize())
    window.addEventListener('apice-ui-size-changed', onSize)
    return () => window.removeEventListener('apice-ui-size-changed', onSize)
  }, [])

  const canIssues = canUser(user, 'issues', 'view')
  const canCreateIssues = canUser(user, 'issues', 'create')
  const canUrgent = canUser(user, 'urgent', 'view')
  const canInterventions = canUser(user, 'interventions', 'view')
  const canReminders = canUser(user, 'reminders', 'view')
  const canPlanning = canUser(user, 'planning_work', 'view') || canUser(user, 'planning_sale', 'view') || canInterventions
  const structureLinks = [
    canUser(user, 'housekeeping', 'view') ? ['housekeeping','housekeeping','Housekeeping'] : null,
    canUser(user, 'supplies', 'view') ? ['supplies','package','Rifornimenti'] : null,
    canUser(user, 'inventory', 'view') ? ['inventory','package','Magazzino'] : null,
    canUser(user, 'temperature', 'view') ? ['temperature','thermometer','Sensori'] : null,
    canUser(user, 'temperature', 'view') ? ['plants','wrench','Impianti'] : null,
  ].filter(Boolean)

  const issuesQuery=useQuery({queryKey:['home13',hotel.id,'issues'],queryFn:()=>fetchIssues(hotel.id),enabled:canIssues})
  const urgentsQuery=useQuery({queryKey:['home13',hotel.id,'urgents'],queryFn:()=>fetchUrgents(hotel.id),enabled:canUrgent})
  const plannedQuery=useQuery({queryKey:['home13',hotel.id,'planned'],queryFn:()=>fetchPlanned(hotel.id),enabled:canPlanning})
  const remindersQuery=useQuery({queryKey:['home13',hotel.id,'reminders',user?.role],queryFn:()=>fetchReminders(hotel.id),enabled:canReminders})
  const weatherQuery=useQuery({queryKey:['home13',hotel.id,'weather'],queryFn:({signal})=>fetchOperationalWeather(hotel.id,{signal}),refetchInterval:5*60_000})
  const loading=[issuesQuery,urgentsQuery,plannedQuery,remindersQuery].some((q)=>q.isPending&&q.fetchStatus!=='idle')

  const issues=issuesQuery.data?.issues||[]
  const urgents=urgentsQuery.data?.items||[]
  const planned=plannedQuery.data?.items||[]
  const reminders=remindersQuery.data||[]
  const openIssues=issues.filter((item)=>item.status!=='done')
  const openUrgents=urgents.filter((item)=>item.status!=='completata')
  const openPlanned=planned.filter((item)=>item.status!=='done')
  const todayInterventions=openPlanned.filter((item)=>isToday(item.scheduledAt)||(item.scheduledAt&&item.scheduledUntil&&item.scheduledAt<=Date.now()&&item.scheduledUntil>=Date.now()))
  const dueReminders=reminders.filter((item)=>reminderDueToday(item,user)).length
  const weather=weatherQuery.data
  const priorities=useMemo(()=>buildPriorityItems({user,openUrgents,openIssues,todayInterventions,reminders,weather}),[user,openUrgents,openIssues,todayInterventions,reminders,weather])
  const visiblePriorities=priorities.slice(0,7)

  const stats=[
    canUrgent?{label:'Allarmi',value:openUrgents.length,route:'urgent',tone:openUrgents.length?'high':'done'}:null,
    canIssues?{label:'Segnalazioni',value:openIssues.length,route:'issues',tone:openIssues.some((x)=>x.urgency==='alta')?'high':'todo'}:null,
    canInterventions?{label:'Interventi oggi',value:todayInterventions.length,route:'interventions',tone:'accent'}:null,
    canReminders?{label:'Promemoria',value:dueReminders,route:'reminders',tone:'waiting'}:null,
  ].filter(Boolean)

  const visibleCardIds=[
    stats.length ? 'status' : null,
    (canIssues||canUrgent||canInterventions||canReminders||weather) ? 'priority' : null,
    canPlanning ? 'planning' : null,
    (canIssues||canUrgent||canInterventions) ? 'operations' : null,
    structureLinks.length ? 'structure' : null,
    canIssues ? 'randai' : null,
  ].filter(Boolean)
  const layout=useMemo(()=>resolveHomeDashboardLayout(visibleCardIds,uiSize),[visibleCardIds.join('|'),uiSize])

  return <section className="rs-workhome" data-testid="home-view" data-home-template={uiSize}>
    <header className="rs-workhome__hero">
      <div><span className="rs-workhome__role">{roleLabel(user)}</span><h1>Ciao, {firstName(user?.name)}</h1><p>{hotel.name} · dashboard operativa</p></div>
      {canCreateIssues&&<Button variant="ghost" size="sm" icon="plus" onClick={()=>onNavigate?.('new-issue')} aria-label="Nuova segnalazione"><span className="rs-workhome__create-label">Nuova</span></Button>}
    </header>

    {loading?<Spinner label="Preparo la dashboard…"/>:<div className="rs-homegrid" data-testid="home-dashboard-grid">
      <MacroCard id="status" title="Stato generale" eyebrow="OGGI" layout={layout}>
        <div className="rs-homecard__metrics">{stats.map((stat)=><Metric key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} onClick={()=>onNavigate?.(stat.route)}/>)}</div>
      </MacroCard>

      <MacroCard id="priority" title="Priorità adesso" eyebrow="COSA FARE" layout={layout}>
        {(weather?.level==='danger'||weather?.level==='warning')&&<button type="button" className={`rs-workhome__weather is-${weather.level}`} data-testid="weather-widget"><Icon name="warning"/><span><strong>{weather.level==='danger'?'Allarme meteo':'Attenzione meteo'}</strong><small>{weather.message||'Controllare gli esterni'}</small></span></button>}
        <div className="rs-homecard__countline"><strong>{visiblePriorities.length}</strong><span>attività rilevanti</span></div>
        {visiblePriorities.length===0?<EmptyState icon="check" title="Nessuna priorità immediata">Non risultano attività urgenti o pianificate per adesso.</EmptyState>:<div className="rs-workhome__queue">{visiblePriorities.map((item,index)=><button key={item.id} type="button" className={`rs-workhome__task tone-${item.tone}`} onClick={()=>item.route&&onNavigate?.(item.route)} disabled={!item.route}><span className="rs-workhome__rank">{index+1}</span><span className="rs-workhome__taskicon"><Icon name={item.icon}/></span><span className="rs-workhome__taskbody"><small>{item.eyebrow}</small><strong>{item.title}</strong><span>{item.meta}</span></span>{item.route&&<Icon name="chevronRight"/>}</button>)}</div>}
      </MacroCard>

      <MacroCard id="planning" title="Planning" eyebrow="RIEPILOGO" layout={layout} onOpen={()=>onNavigate?.('planning-work')}>
        <div className="rs-homecard__metrics rs-homecard__metrics--compact"><Metric label="Lavori oggi" value={todayInterventions.length} tone="accent" onClick={()=>onNavigate?.('planning-work')}/><Metric label="Aperti" value={openPlanned.length} tone="todo" onClick={()=>onNavigate?.('planning-work')}/></div>
      </MacroCard>

      <MacroCard id="operations" title="Operatività" eyebrow="RIEPILOGO" layout={layout} onOpen={()=>onNavigate?.('operations')}>
        <div className="rs-homecard__metrics rs-homecard__metrics--compact">{canIssues&&<Metric label="Segnalazioni" value={openIssues.length} tone={openIssues.length?'todo':'done'} onClick={()=>onNavigate?.('issues')}/>} {canUrgent&&<Metric label="Allarmi" value={openUrgents.length} tone={openUrgents.length?'high':'done'} onClick={()=>onNavigate?.('urgent')}/>} {canInterventions&&<Metric label="Interventi oggi" value={todayInterventions.length} tone="accent" onClick={()=>onNavigate?.('interventions')}/>}</div>
      </MacroCard>

      <MacroCard id="structure" title="Struttura" eyebrow="AREE" layout={layout}>
        <div className="rs-homecard__countline"><strong>{structureLinks.length}</strong><span>aree disponibili</span></div>
        <div className="rs-workhome__quick">{structureLinks.map(([route,icon,label])=><button key={route} type="button" onClick={()=>onNavigate?.(route)}><Icon name={icon}/><span>{label}</span><Icon name="chevronRight"/></button>)}</div>
      </MacroCard>

      <MacroCard id="randai" title="RandAI & Attività" eyebrow="ASSISTENZA" layout={layout}>
        <div className="rs-homecard__countline"><strong>{priorities.length}</strong><span>attività monitorate</span></div>
        <RandAIPriorityCard hotel={hotel} user={user} onNavigate={onNavigate}/>
      </MacroCard>
    </div>}
  </section>
}

export default function Home(props){return <QueryClientProvider client={queryClient}><HomeData {...props}/></QueryClientProvider>}
