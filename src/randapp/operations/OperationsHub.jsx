import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlanned, subscribePlanned } from '../../planned-data.js'
import { Icon } from '../ui.jsx'
import { Grid, PageTitle, Stack, Surface } from '../randui/visual-primitives.jsx'

const urgencyRank = { alta: 3, media: 2, bassa: 1 }
const issueTime = (item) => Number(item.createdAt || 0)
const interventionTime = (item) => Number(item.scheduledAt || item.createdAt || 0)
const shortWhen = (value) => value ? new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : ''

function OperationalChoice({ icon, title, description, count, onClick, testId }) {
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

export default function OperationsHub({ hotel, canIssues, canInterventions, onOpen }) {
  const [issues,setIssues]=useState([])
  const [interventions,setInterventions]=useState([])

  const loadIssues=useCallback(async()=>{ if(!canIssues)return setIssues([]); try{const result=await fetchIssues(hotel.id);setIssues(result.issues||[])}catch{setIssues([])} },[hotel.id,canIssues])
  const loadInterventions=useCallback(async()=>{ if(!canInterventions)return setInterventions([]); try{const result=await fetchPlanned(hotel.id);setInterventions(result.items||[])}catch{setInterventions([])} },[hotel.id,canInterventions])

  useEffect(()=>{loadIssues();const off=canIssues?subscribeIssues(hotel.id,loadIssues):null;return()=>off?.()},[hotel.id,canIssues,loadIssues])
  useEffect(()=>{loadInterventions();const off=canInterventions?subscribePlanned(hotel.id,loadInterventions):null;return()=>off?.()},[hotel.id,canInterventions,loadInterventions])

  const openIssues=useMemo(()=>issues.filter(x=>x.status!=='done').sort((a,b)=>(urgencyRank[b.urgency]||0)-(urgencyRank[a.urgency]||0)||issueTime(b)-issueTime(a)),[issues])
  const openInterventions=useMemo(()=>interventions.filter(x=>x.status!=='done').sort((a,b)=>interventionTime(a)-interventionTime(b)),[interventions])
  const visibleCount = Number(Boolean(canIssues)) + Number(Boolean(canInterventions))

  return (
    <Stack gap="sm" className="rs-operations-hub" data-testid="operations-hub">
      <PageTitle title="Operatività" subtitle="Situazione reale della struttura: segnalazioni e interventi aperti." />
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-choice-grid rs-randui-grid--keep-mobile">
        {canIssues && <OperationalChoice icon="issues" title="Segnalazioni" count={openIssues.length} description="Problemi aperti, ordinati per urgenza." onClick={()=>onOpen('issues')} testId="operations-open-issues"/>}
        {canInterventions && <OperationalChoice icon="wrench" title="Interventi" count={openInterventions.length} description="Lavori attivi e prossime attività pianificate." onClick={()=>onOpen('interventions')} testId="operations-open-interventions"/>}
      </Grid>
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-preview-grid">
        {canIssues && <PreviewSection title="Segnalazioni in evidenza" icon="issues" items={openIssues} empty="Nessuna segnalazione aperta." renderTitle={(x)=>x.room||x.title||'Segnalazione'} renderMeta={(x)=>[x.title,x.category,x.urgency&&('Urgenza '+x.urgency)].filter(Boolean).join(' · ')} onOpen={(id)=>onOpen('issues',id)} testId="operations-top-issues"/>}
        {canInterventions && <PreviewSection title="Interventi in evidenza" icon="wrench" items={openInterventions} empty="Nessun intervento aperto." renderTitle={(x)=>x.location||'Intervento'} renderMeta={(x)=>[x.category||'Manutenzione',shortWhen(x.scheduledAt),x.notes].filter(Boolean).join(' · ')} onOpen={(id)=>onOpen('interventions',id)} testId="operations-top-interventions"/>}
      </Grid>
    </Stack>
  )
}
