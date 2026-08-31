import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { fetchReminders } from './reminders/reminder-data.js'
import { canUser } from '../permissions.js'
import { firstName, isToday, URGENCY_META } from './helpers.js'
import { Badge, Button, Card, EmptyState, Icon, Spinner } from './ui.jsx'
import RandAIPriorityCard from './RandAIPriorityCard.jsx'

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

function buildPriorityItems({ user, openUrgents, openIssues, todayInterventions, reminders, weather }) {
  const rows = []
  if (canUser(user, 'urgent', 'view')) openUrgents.forEach((item) => rows.push({ id:`urgent-${item.id}`,score:100,tone:'high',icon:'warning',route:'urgent',eyebrow:'Urgente',title:item.message||item.title||item.location||'Richiesta urgente',meta:item.location||item.room||'Richiede attenzione immediata' }))
  if (weather?.level === 'danger' || weather?.level === 'warning') rows.push({ id:'weather',score:weather.level === 'danger' ? 96 : 82,tone:weather.level==='danger'?'high':'mid',icon:'thermometer',eyebrow:weather.level==='danger'?'Allarme meteo':'Attenzione meteo',title:weather.message||'Controllare gli esterni',meta:weather.level==='danger'?'Azione consigliata adesso':'Verifica preventiva' })
  if (canUser(user, 'issues', 'view')) openIssues.forEach((item) => rows.push({ id:`issue-${item.id}`,score:item.urgency === 'alta' ? 92 : item.urgency === 'media' ? 58 : 42,tone:URGENCY_META[item.urgency]?.tone||'mid',icon:'issues',route:'issues',eyebrow:'Segnalazione',title:item.title||'Segnalazione aperta',meta:item.room||'Da gestire',createdAt:item.createdAt }))
  if (canUser(user, 'reminders', 'view')) reminders.filter((item) => reminderDueToday(item,user)).forEach((item) => rows.push({ id:`reminder-${item.id}`,score:78,tone:'accent',icon:'bell',route:'reminders',eyebrow:'Promemoria',title:item.message||'Promemoria',meta:(item.times||[]).length?`Oggi · ${(item.times||[]).join(' · ')}`:'Oggi' }))
  if (canUser(user, 'interventions', 'view')) todayInterventions.forEach((item) => rows.push({ id:`planned-${item.id}`,score:item.scheduledAt&&item.scheduledAt<Date.now()?76:68,tone:'todo',icon:'wrench',route:'interventions',eyebrow:'Intervento oggi',title:item.notes||item.category||'Intervento pianificato',meta:[item.location,timeLabel(item.scheduledAt)].filter(Boolean).join(' · ')||'Pianificato oggi' }))
  return rows.sort((a,b)=>b.score-a.score||(a.createdAt||0)-(b.createdAt||0))
}

function HomeData({ user, hotel, onNavigate, personalizeSignal }) {
  const [focusOnly,setFocusOnly]=useState(readFocus)
  const [preferencesOpen,setPreferencesOpen]=useState(false)
  useEffect(()=>{ if(personalizeSignal>0) setPreferencesOpen(true) },[personalizeSignal])
  const canIssues = canUser(user, 'issues', 'view')
  const canUrgent = canUser(user, 'urgent', 'view')
  const canInterventions = canUser(user, 'interventions', 'view')
  const canReminders = canUser(user, 'reminders', 'view')
  const issuesQuery=useQuery({queryKey:['home13',hotel.id,'issues'],queryFn:()=>fetchIssues(hotel.id),enabled:canIssues})
  const urgentsQuery=useQuery({queryKey:['home13',hotel.id,'urgents'],queryFn:()=>fetchUrgents(hotel.id),enabled:canUrgent})
  const plannedQuery=useQuery({queryKey:['home13',hotel.id,'planned'],queryFn:()=>fetchPlanned(hotel.id),enabled:canInterventions})
  const remindersQuery=useQuery({queryKey:['home13',hotel.id,'reminders',user?.role],queryFn:()=>fetchReminders(hotel.id),enabled:canReminders})
  const weatherQuery=useQuery({queryKey:['home13',hotel.id,'weather'],queryFn:({signal})=>fetchOperationalWeather(hotel.id,{signal}),refetchInterval:5*60_000})
  const loading=[issuesQuery,urgentsQuery,plannedQuery,remindersQuery].some((q)=>q.isPending&&q.fetchStatus!=='idle')
  const issues=issuesQuery.data?.issues||[], urgents=urgentsQuery.data?.items||[], planned=plannedQuery.data?.items||[], reminders=remindersQuery.data||[]
  const openIssues=issues.filter((item)=>item.status!=='done'), openUrgents=urgents.filter((item)=>item.status!=='completata')
  const todayInterventions=planned.filter((item)=>item.status!=='done'&&(isToday(item.scheduledAt)||(item.scheduledAt&&item.scheduledUntil&&item.scheduledAt<=Date.now()&&item.scheduledUntil>=Date.now())))
  const weather=weatherQuery.data
  const priorities=useMemo(()=>buildPriorityItems({user,openUrgents,openIssues,todayInterventions,reminders,weather}),[user,openUrgents,openIssues,todayInterventions,reminders,weather])
  const visiblePriorities=focusOnly?priorities.filter((item)=>item.score>=68).slice(0,7):priorities.slice(0,10)
  const dueReminders=reminders.filter((item)=>reminderDueToday(item,user)).length
  const stats=[canUrgent?{label:'Urgenti',value:openUrgents.length,route:'urgent',tone:openUrgents.length?'high':'done'}:null,canIssues?{label:'Da fare',value:openIssues.length,route:'issues',tone:openIssues.some((x)=>x.urgency==='alta')?'high':'todo'}:null,canInterventions?{label:'Oggi',value:todayInterventions.length,route:'interventions',tone:'accent'}:null,canReminders?{label:'Promemoria',value:dueReminders,route:'reminders',tone:'waiting'}:null].filter(Boolean)
  const quick=[canUser(user, 'issues', 'create')?['issues','plus','Nuova segnalazione']:null,canInterventions?['interventions','wrench','Interventi']:null,canUser(user, 'housekeeping', 'view')?['housekeeping','housekeeping','Housekeeping']:null,canReminders?['reminders','bell','Promemoria']:null].filter(Boolean).slice(0,4)
  const setMode=(focus)=>{setFocusOnly(focus);writeFocus(focus)}

  return <section className="rs-workhome" data-testid="home-view"><style>{HOME13_STYLES}</style>
    <header className="rs-workhome__hero"><div><span className="rs-workhome__role">{roleLabel(user)}</span><h1>Ciao, {firstName(user?.name)}</h1><p>{hotel.name} · cosa richiede attenzione adesso</p></div><Button variant="ghost" size="sm" icon="sliders" onClick={()=>setPreferencesOpen((v)=>!v)} aria-expanded={preferencesOpen}>Vista</Button></header>
    {preferencesOpen&&<Card className="rs-card--pad rs-workhome__prefs"><div><strong>Vista Home</strong><small>La priorità resta automatica; puoi scegliere quanta informazione mostrare.</small></div><div className="rs-segmented" role="group" aria-label="Vista Home"><button type="button" className={focusOnly?'active':''} onClick={()=>setMode(true)}>Focus</button><button type="button" className={!focusOnly?'active':''} onClick={()=>setMode(false)}>Completa</button></div></Card>}
    {loading?<Spinner label="Preparo le priorità della giornata…"/>:<>
      <div className="rs-workhome__stats" data-testid="home-stats">{stats.map((stat)=><button key={stat.label} type="button" className="rs-workhome__stat" onClick={()=>onNavigate?.(stat.route)}><Badge tone={stat.tone}>{stat.label}</Badge><strong>{stat.value}</strong></button>)}</div>
      {(weather?.level==='danger'||weather?.level==='warning')&&<button type="button" className={`rs-workhome__weather is-${weather.level}`} onClick={()=>{}} data-testid="weather-widget"><Icon name="warning"/><span><strong>{weather.level==='danger'?'Allarme meteo':'Attenzione meteo'}</strong><small>{weather.message||'Controllare gli esterni'}</small></span></button>}
      {canIssues&&<RandAIPriorityCard hotel={hotel} user={user} onNavigate={onNavigate}/>} 
      <div className="rs-workhome__sectionhead"><div><span>PRIORITÀ</span><h2>Cosa fare adesso</h2></div><small>{visiblePriorities.length} attività rilevanti</small></div>
      {visiblePriorities.length===0?<EmptyState icon="check" title="Nessuna priorità immediata">Non risultano attività urgenti o pianificate per adesso.</EmptyState>:<div className="rs-workhome__queue">{visiblePriorities.map((item,index)=><button key={item.id} type="button" className={`rs-workhome__task tone-${item.tone}`} onClick={()=>item.route&&onNavigate?.(item.route)} disabled={!item.route}><span className="rs-workhome__rank">{index+1}</span><span className="rs-workhome__taskicon"><Icon name={item.icon}/></span><span className="rs-workhome__taskbody"><small>{item.eyebrow}</small><strong>{item.title}</strong><span>{item.meta}</span></span>{item.route&&<Icon name="chevronRight"/>}</button>)}</div>}
      {!focusOnly&&<><div className="rs-workhome__sectionhead"><div><span>SCORCIATOIE</span><h2>Vai al lavoro</h2></div></div><div className="rs-workhome__quick">{quick.map(([route,icon,label])=><button key={route} type="button" onClick={()=>onNavigate?.(route)}><Icon name={icon}/><span>{label}</span><Icon name="chevronRight"/></button>)}</div></>}
    </>}
  </section>
}

const HOME13_STYLES=`
.rs-workhome{display:grid;gap:18px}.rs-workhome__hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-top:4px}.rs-workhome__hero h1{margin:4px 0 2px;font-family:Sora,sans-serif;font-size:clamp(1.55rem,4vw,2.2rem)}.rs-workhome__hero p{margin:0;color:var(--rs-text-2);font-size:.9rem}.rs-workhome__role{display:inline-flex;color:var(--rs-cyan);font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.rs-workhome__prefs{display:flex;align-items:center;justify-content:space-between;gap:14px}.rs-workhome__prefs>div:first-child{display:grid;gap:3px}.rs-workhome__prefs small{color:var(--rs-text-2)}.rs-workhome__prefs .rs-segmented{min-width:210px}.rs-workhome__stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}.rs-workhome__stat{min-height:92px;padding:13px;border:1px solid var(--rs-line);border-radius:16px;background:linear-gradient(160deg,var(--rs-surface-2),var(--rs-surface));color:var(--rs-text);text-align:left;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;cursor:pointer}.rs-workhome__stat strong{font-family:Sora,sans-serif;font-size:1.9rem;line-height:1}.rs-workhome__weather{width:100%;min-height:68px;padding:12px 14px;border-radius:16px;border:1px solid var(--rs-line);background:var(--rs-surface-2);color:var(--rs-text);display:flex;align-items:center;gap:12px;text-align:left}.rs-workhome__weather.is-danger{border-color:rgba(246,96,125,.55);background:rgba(246,96,125,.12)}.rs-workhome__weather.is-warning{border-color:rgba(247,185,85,.5);background:rgba(247,185,85,.09)}.rs-workhome__weather>.rs-icon{width:26px;height:26px}.rs-workhome__weather span{display:grid;gap:2px}.rs-workhome__weather small{color:var(--rs-text-2)}.rs-workhome__sectionhead{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-top:4px}.rs-workhome__sectionhead span{color:var(--rs-cyan);font-size:.68rem;font-weight:800;letter-spacing:.08em}.rs-workhome__sectionhead h2{margin:2px 0 0;font-family:Sora,sans-serif;font-size:1.12rem}.rs-workhome__sectionhead>small{color:var(--rs-text-3);font-size:.76rem}.rs-workhome__queue{display:grid;gap:9px}.rs-workhome__task{width:100%;min-height:76px;padding:10px 12px;border:1px solid var(--rs-line);border-radius:16px;background:linear-gradient(160deg,var(--rs-surface-2),var(--rs-surface));color:var(--rs-text);display:grid;grid-template-columns:28px 40px minmax(0,1fr) 20px;align-items:center;gap:10px;text-align:left;cursor:pointer}.rs-workhome__task:disabled{cursor:default}.rs-workhome__rank{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;background:var(--rs-surface-3);color:var(--rs-text-2);font-weight:800;font-size:.76rem}.rs-workhome__taskicon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(34,211,238,.1);color:var(--rs-cyan)}.rs-workhome__task.tone-high{border-color:rgba(246,96,125,.42)}.rs-workhome__task.tone-high .rs-workhome__taskicon{background:rgba(246,96,125,.12);color:#ff8ba0}.rs-workhome__task.tone-mid .rs-workhome__taskicon,.rs-workhome__task.tone-waiting .rs-workhome__taskicon{background:rgba(247,185,85,.11);color:var(--rs-warn)}.rs-workhome__taskbody{min-width:0;display:grid;gap:2px}.rs-workhome__taskbody small{color:var(--rs-text-3);font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.rs-workhome__taskbody strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.93rem}.rs-workhome__taskbody span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rs-text-2);font-size:.78rem}.rs-workhome__task>.rs-icon{color:var(--rs-text-3)}.rs-workhome__quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.rs-workhome__quick button{min-height:58px;padding:10px 12px;border:1px solid var(--rs-line);border-radius:15px;background:var(--rs-surface-2);color:var(--rs-text);display:grid;grid-template-columns:24px 1fr 18px;align-items:center;gap:9px;text-align:left}.rs-workhome__quick button>.rs-icon:first-child{color:var(--rs-cyan)}.rs-workhome__quick span{font-weight:700}@media(max-width:520px){.rs-workhome{gap:15px}.rs-workhome__prefs{align-items:stretch;flex-direction:column}.rs-workhome__prefs .rs-segmented{min-width:0;width:100%}.rs-workhome__stats{grid-template-columns:repeat(2,minmax(0,1fr))}.rs-workhome__task{grid-template-columns:24px 36px minmax(0,1fr) 18px;padding:9px;gap:8px}.rs-workhome__taskicon{width:36px;height:36px}.rs-workhome__quick{grid-template-columns:1fr}.rs-workhome__sectionhead>small{display:none}}
`

export default function Home(props){return <QueryClientProvider client={queryClient}><HomeData {...props}/></QueryClientProvider>}
