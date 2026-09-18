import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchReminders, subscribeReminders } from '../reminders/reminder-data.js'
import { fetchUrgents, subscribeUrgents } from '../../urgents-data.js'
import { Icon } from '../ui.jsx'
import { Grid, PageTitle, Stack, Surface } from '../randui/visual-primitives.jsx'

const urgentTime = (item) => Number(item.createdAt || 0)
const reminderTime = (item) => Number(new Date(item.start_date || 0))
const whenLabel = (item) => {
  const times = (item.times || []).filter(Boolean)
  if (times.length) return times.join(' · ')
  if (item.start_date) return item.start_date
  return 'Senza orario'
}

function TaskChoice({ icon, title, description, count, onClick, testId }) {
  return (
    <button type="button" className="rs-randui-choice rs-operational-choice" onClick={onClick} data-testid={testId}>
      <div className="rs-randui-choice__head">
        <span className="rs-randui-choice__icon" aria-hidden="true"><Icon name={icon} /></span>
        <strong>{title}</strong>
        {Number.isFinite(count) && <span className="rs-operational-choice__count">{count}</span>}
        <span className="rs-randui-choice__chevron" aria-hidden="true">›</span>
      </div>
      <p className="rs-operational-choice__description">{description}</p>
    </button>
  )
}

function PreviewSection({ title, icon, items, empty, renderMeta, renderTitle, onOpen, testId }) {
  return (
    <Surface className="rs-operational-preview" data-testid={testId}>
      <header className="rs-operational-preview__head">
        <span><Icon name={icon}/><strong>{title}</strong></span>
        <small>Top {Math.min(items.length,3)}</small>
      </header>
      {items.length ? (
        <div className="rs-operational-preview__list">
          {items.slice(0,3).map((item) => (
            <button type="button" key={item.id} className="rs-operational-preview__row" onClick={() => onOpen(item.id)}>
              <span className="rs-operational-preview__copy">
                <strong>{renderTitle(item)}</strong>
                <small>{renderMeta(item)}</small>
              </span>
              <Icon name="chevronRight"/>
            </button>
          ))}
        </div>
      ) : <p className="rs-operational-preview__empty">{empty}</p>}
    </Surface>
  )
}

export default function TaskHub({ hotel, user, canReminders, canUrgent, onOpen }) {
  const [reminders,setReminders]=useState([])
  const [urgents,setUrgents]=useState([])

  const loadReminders=useCallback(async()=>{if(!canReminders)return setReminders([]);try{setReminders(await fetchReminders(hotel.id)||[])}catch{setReminders([])}},[hotel.id,canReminders])
  const loadUrgents=useCallback(async()=>{if(!canUrgent)return setUrgents([]);try{const result=await fetchUrgents(hotel.id);setUrgents(result.items||[])}catch{setUrgents([])}},[hotel.id,canUrgent])

  useEffect(()=>{loadReminders();const off=canReminders?subscribeReminders(hotel.id,loadReminders):null;return()=>off?.()},[hotel.id,canReminders,loadReminders])
  useEffect(()=>{loadUrgents();const off=canUrgent?subscribeUrgents(hotel.id,loadUrgents):null;return()=>off?.()},[hotel.id,canUrgent,loadUrgents])

  const activeReminders=useMemo(()=>reminders.filter(x=>x.active).sort((a,b)=>reminderTime(a)-reminderTime(b)),[reminders])
  const activeUrgents=useMemo(()=>urgents.filter(x=>x.status!=='completata').sort((a,b)=>urgentTime(b)-urgentTime(a)),[urgents])
  const visibleCount = Number(Boolean(canReminders)) + Number(Boolean(canUrgent))

  return (
    <Stack gap="sm" className="rs-task-hub" data-testid="task-hub">
      <PageTitle title="Task" subtitle="Promemoria e avvisi attivi della struttura, con accesso diretto ai singoli elementi." />
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-choice-grid rs-randui-grid--keep-mobile">
        {canReminders && <TaskChoice icon="bell" title="Promemoria" count={activeReminders.length} description="Scadenze e attività da ricordare." onClick={()=>onOpen('reminders')} testId="task-open-reminders"/>}
        {canUrgent && <TaskChoice icon="warning" title="Avvisi" count={activeUrgents.length} description="Avvisi urgenti ancora da gestire." onClick={()=>onOpen('urgent')} testId="task-open-urgent"/>}
      </Grid>
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-preview-grid">
        {canReminders && <PreviewSection title="Promemoria in evidenza" icon="bell" items={activeReminders} empty="Nessun promemoria attivo." renderTitle={(x)=>x.message||'Promemoria'} renderMeta={(x)=>[whenLabel(x),(x.target_roles||[]).join(', ')].filter(Boolean).join(' · ')} onOpen={(id)=>onOpen('reminders',id)} testId="task-top-reminders"/>}
        {canUrgent && <PreviewSection title="Avvisi in evidenza" icon="warning" items={activeUrgents} empty="Nessun avviso attivo." renderTitle={(x)=>x.location||'Avviso urgente'} renderMeta={(x)=>[x.note,x.createdBy].filter(Boolean).join(' · ')} onOpen={(id)=>onOpen('urgent',id)} testId="task-top-urgent"/>}
      </Grid>
    </Stack>
  )
}
