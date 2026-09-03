import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSession } from '../session.js'
import { retrieveRandAIGuidance } from './randai-data.js'
import { getIssueWorkspace, startIssueWorkspace, confirmIssueWorkspaceStep, prepareIssueCompletionSummary, issueWorkspaceProgress } from './issue-workspace.js'
import { getRandAIContext } from './context/envelope.js'
import { buildProjectIntelligence } from './project-intelligence.js'
import { createBrowserRandAudio, createTranscriptArtifact } from './audio/index.js'
import './randai.css'

const EVENT = 'apice-session-changed'
const OPEN_EVENT = 'randai-toggle'

function hvacConclusionLabel(diagnostic) {
  const labels = {
    'check-upstream-data': 'Prima controllo i dati a monte: almeno una temperatura Wine è assente, offline o non recente.',
    'circuit-off': 'Il circuito della zona risulta SPENTO. È il primo controllo da risolvere prima di cercare un guasto nella camera.',
    'circuit-on-check-downstream': 'Il circuito risulta ATTIVO. Senza soglie termiche definite non dichiaro le temperature “corrette”; se il problema persiste, il controllo successivo è a valle verso camera/ramo.',
    'check-circuit-state': 'Le temperature di riferimento sono disponibili, ma lo stato del circuito non è affidabile: va verificato prima di proseguire.',
    'check-floor-temperature-data': 'Prima controllo il sensore C/F del piano Jazz: il dato è assente, offline o non recente.',
    'floor-temperature-available-switch-unmapped': 'Il sensore C/F del piano Jazz è disponibile. L’interruttore del piano non è ancora mappato, quindi RandAI non inventa uno stato ON/OFF.',
    'floor-circuit-off': 'Il circuito del piano Jazz risulta SPENTO.',
    'floor-circuit-on-check-downstream': 'Il circuito del piano Jazz risulta ATTIVO; se il problema persiste, il controllo successivo è a valle.',
    'insufficient-data': 'I dati disponibili non bastano ancora per restringere la diagnosi.',
  }
  return labels[diagnostic?.conclusion] || labels['insufficient-data']
}

function HvacDiagnostic({ diagnostic }) {
  if (!diagnostic) return null
  const modeLabel = diagnostic.mode === 'cooling' ? 'Aria fredda' : diagnostic.mode === 'heating' ? 'Aria calda' : 'Caldo/Freddo'
  return (
    <div className="randai__equipment randai__hvac">
      <b>Diagnosi HVAC · {modeLabel}</b>
      <div className="randai__equipment-item">
        <strong>{diagnostic.zone_label}</strong>
        <span>
          {diagnostic.room ? `Camera ${diagnostic.room} · ` : ''}
          {diagnostic.section === 'wine' ? `Wine${diagnostic.circuit ? ` · ${diagnostic.circuit}` : ''}` : `Jazz · Piano ${diagnostic.floor}`}
        </span>
      </div>
      {diagnostic.temperatures?.map((sensor) => (
        <div key={sensor.device_id} className="randai__equipment-item">
          <strong>{sensor.name}</strong>
          <span>{sensor.online ? 'Online' : 'Offline'}{sensor.stale ? ' · dato non recente' : ''}</span>
          <small>{sensor.temperature != null ? `${sensor.temperature} °C` : 'Temperatura non disponibile'}{sensor.alert ? ' · ALLERTA' : ''}</small>
        </div>
      ))}
      {diagnostic.switch && (
        <div className="randai__equipment-item">
          <strong>Interruttore zona</strong>
          <span>{diagnostic.switch.status_label}{diagnostic.switch.stale ? ' · dato non recente' : ''}</span>
          <small>{diagnostic.switch.online ? 'Dispositivo online' : 'Dispositivo offline'}</small>
        </div>
      )}
      {!diagnostic.switch && diagnostic.section === 'jazz' && (
        <div className="randai__equipment-item">
          <strong>Interruttore piano Jazz</strong>
          <span>NON ANCORA MAPPATO</span>
          <small>La struttura è pronta per collegarlo appena viene identificato il device eWeLink corretto.</small>
        </div>
      )}
      <div className="randai__caution">{hvacConclusionLabel(diagnostic)}</div>
      {!diagnostic.thresholds_defined && <small>Soglie caldo/freddo non ancora definite: RandAI mostra i valori reali ma non li classifica arbitrariamente come normali o anomali.</small>}
    </div>
  )
}

function ProjectIntelligencePanel({ intelligence }) {
  if (!intelligence) return null
  const assessmentLabels = {
    RECURRING_PATTERN: 'Possibile ricorrenza',
    CONNECTED: 'Collegamenti trovati',
    ISOLATED: 'Nessun collegamento forte',
    INSUFFICIENT_DATA: 'Dati insufficienti',
  }
  return (
    <div className="randai__project-intelligence" data-testid="randai-project-intelligence">
      <b>Project Intelligence</b>
      <strong>{assessmentLabels[intelligence.assessment] || 'Analisi progetto'}</strong>
      <p>{intelligence.summary}</p>
      {intelligence.signals?.length > 0 && (
        <div className="randai__project-signals">
          {intelligence.signals.map((signal) => <span key={signal.id}>{signal.label}: {signal.value}</span>)}
        </div>
      )}
      {intelligence.hypotheses?.map((hypothesis) => (
        <div className="randai__project-hypothesis" key={hypothesis.id}>
          <strong>{hypothesis.label}</strong>
          <small>{hypothesis.caution}</small>
        </div>
      ))}
      {intelligence.nextActions?.length > 0 && (
        <ol>
          {intelligence.nextActions.map((action) => <li key={action.id}>{action.label}</li>)}
        </ol>
      )}
    </div>
  )
}

export default function RandAIAssistant() {
  const [session, setSession] = useState(loadSession())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [workspace, setWorkspace] = useState(null)
  const [workspaceSummary, setWorkspaceSummary] = useState('')
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const audio = useRef(null)

  if (!audio.current && typeof window !== 'undefined') audio.current = createBrowserRandAudio(window)

  useEffect(() => {
    const refresh = () => setSession(loadSession())
    window.addEventListener(EVENT, refresh)
    return () => window.removeEventListener(EVENT, refresh)
  }, [])

  useEffect(() => {
    setOpen(false)
    setMessages([])
    setQuery('')
    setBusy(false)
    audio.current?.stopListening()
    audio.current?.stopSpeaking()
    setListening(false)
    setAudioNotice('')
  }, [session?.hotelId, session?.userId])

  useEffect(() => {
    const toggle = () => setOpen((value) => !value)
    window.addEventListener(OPEN_EVENT, toggle)
    return () => window.removeEventListener(OPEN_EVENT, toggle)
  }, [])

  const hotelLabel = useMemo(() => ({ hotelgio: 'Hotel Giò', chocohotel: 'Chocohotel', brigantino: 'Il Brigantino' }[session?.hotelId] || 'struttura attiva'), [session?.hotelId])
  if (!session?.hotelId) return null
  const activeResource = getRandAIContext()?.resource
  const issueResource = activeResource?.type === 'issue' ? activeResource : null
  const workspaceProgress = issueWorkspaceProgress(workspace)
  const canDictate = Boolean(audio.current?.capabilities.stt)

  const startDictation = () => {
    if (!canDictate || listening) return
    setListening(true)
    setAudioNotice('Ascolto… la trascrizione dovrà essere confermata prima dell’invio.')
    try {
      audio.current.listen({
        onResult: ({ text, confidence }) => {
          const artifact = createTranscriptArtifact({ hotelId: session.hotelId, text, confidence })
          setQuery((current) => [current.trim(), artifact.transcript].filter(Boolean).join(' '))
          setAudioNotice('Trascrizione inserita: controllala e premi Chiedi per confermare.')
        },
        onError: () => setAudioNotice('Dettatura non riuscita. Puoi continuare a scrivere.'),
        onEnd: () => setListening(false),
      })
    } catch {
      setListening(false)
      setAudioNotice('Dettatura non disponibile su questo dispositivo.')
    }
  }

  const readMessage = (message) => {
    const text = message.text || [message.procedure?.title, message.procedure?.summary, ...(message.procedure?.steps || [])].filter(Boolean).join('. ')
    if (!text) return
    try { audio.current?.speak(text) } catch { setAudioNotice('Lettura vocale non disponibile su questo dispositivo.') }
  }

  const refreshWorkspace = async (issueId = issueResource?.id) => {
    if (!issueId) return
    try { setWorkspace(await getIssueWorkspace({ hotelId: session.hotelId, issueId })) } catch (error) { console.error('RandAI workspace load failed', error) }
  }

  const beginGuidedProcedure = async (procedureId) => {
    if (!issueResource?.id || workspaceBusy) return
    setWorkspaceBusy(true)
    try {
      const task = await startIssueWorkspace({ hotelId: session.hotelId, issueId: issueResource.id, procedureId })
      setWorkspace(task)
      setWorkspaceSummary('')
    } catch (error) { console.error('RandAI guided procedure start failed', error) }
    finally { setWorkspaceBusy(false) }
  }

  const confirmGuidedStep = async () => {
    if (!issueResource?.id || !workspace?.id || workspaceBusy) return
    setWorkspaceBusy(true)
    try {
      const task = await confirmIssueWorkspaceStep({ hotelId: session.hotelId, issueId: issueResource.id, taskId: workspace.id })
      setWorkspace(task)
      if (task?.status === 'VERIFYING' || task?.status === 'SUCCEEDED') setWorkspaceSummary(await prepareIssueCompletionSummary({ hotelId: session.hotelId, issueId: issueResource.id, taskId: workspace.id }))
    } catch (error) { console.error('RandAI guided procedure step failed', error) }
    finally { setWorkspaceBusy(false) }
  }

  const submit = async (event) => {
    event.preventDefault()
    const clean = query.trim()
    if (!clean || busy) return
    const previousGuidance = [...messages].reverse().find((message) => message.role === 'assistant' && message.kind === 'guidance' && message.resolvedQuery)
    const previousUser = [...messages].reverse().find((message) => message.role === 'user')
    const contextQuery = previousGuidance?.resolvedQuery || previousUser?.text || ''
    setMessages((current) => [...current, { role: 'user', text: clean }])
    setQuery('')
    setBusy(true)

    try {
      const guidance = await retrieveRandAIGuidance({ hotelId: session.hotelId, query: clean, contextQuery })
      if (!guidance) {
        setMessages((current) => [...current, { role: 'assistant', kind: 'missing', text: 'Non trovo ancora conoscenza approvata o dati live sufficienti per questo problema. Non improvviso: raccogliamo zona, impianto e sintomi e poi decidiamo il controllo successivo.' }])
        return
      }
      setMessages((current) => [...current, { role: 'assistant', kind: 'guidance', ...guidance }])
    } catch (error) {
      console.error('RandAI knowledge retrieval failed', error)
      setMessages((current) => [...current, { role: 'assistant', kind: 'error', text: 'Non riesco a leggere la base tecnica in questo momento. Non improvviso: riprova tra poco oppure segui la procedura manuale già nota alla squadra.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`randai ${open ? 'randai--open' : ''}`} data-testid="randai-root">
      {open && (
        <section className="randai__panel" role="dialog" aria-label="RandAI assistente manutenzione">
          <header className="randai__header">
            <div><strong>RandAI</strong><small>Assistente manutenzione · {hotelLabel}</small></div>
            <button type="button" className="randai__close" onClick={() => setOpen(false)} aria-label="Chiudi RandAI">×</button>
          </header>

          <div className="randai__messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="randai__welcome">
                <b>Come posso aiutarti?</b>
                <p>Descrivi il problema. Controllo prima memoria verificata, dati live, procedure, impianti, manuali e storico della struttura.</p>
                {session.hotelId === 'hotelgio' && <button type="button" onClick={() => setQuery('Camera 125 non fredda')}>Prova: camera 125 non fredda</button>}
              </div>
            )}

            {messages.map((message, index) => message.role === 'user' ? (
              <div className="randai__bubble randai__bubble--user" key={`${index}-${message.text}`}>{message.text}</div>
            ) : message.kind === 'guidance' ? (
              <article className="randai__bubble randai__bubble--assistant" key={`guidance-${index}`}>
                {audio.current?.capabilities.tts && <button type="button" className="randai__audio-action" onClick={() => readMessage(message)} aria-label="Leggi la risposta RandAI">🔊 Leggi</button>}
                <HvacDiagnostic diagnostic={message.hvacDiagnostic} />
                {issueResource?.id && <ProjectIntelligencePanel intelligence={buildProjectIntelligence({ hotelId: session.hotelId, issue: issueResource, equipment: message.equipment, history: message.history, memory: message.memory, suggestions: message.suggestions, documents: message.documents, sensors: message.sensors })} />}
                {message.sensors?.length > 0 && (
                  <div className="randai__equipment">
                    <b>Dati live impianto</b>
                    {message.sensors.map((sensor) => (
                      <div key={sensor.device_id} className="randai__equipment-item">
                        <strong>{sensor.semantic_label}</strong>
                        <span>{sensor.online ? 'Online' : 'Offline'}{sensor.stale ? ' · dato non recente' : ''}</span>
                        {sensor.temperature != null && <small>{sensor.temperature} {sensor.unit || '°C'} · {sensor.zone}</small>}
                      </div>
                    ))}
                  </div>
                )}
                {message.procedure && issueResource?.id && (
                  <div className="randai__workspace" data-testid="randai-guided-procedure">
                    <b>Procedura guidata</b>
                    {!workspace && <button type="button" onClick={() => beginGuidedProcedure(message.procedure.id)} disabled={workspaceBusy}>{workspaceBusy ? 'Avvio…' : 'Avvia procedura guidata'}</button>}
                    {workspace && (
                      <>
                        <small>{workspaceProgress?.label} · {workspace.status}</small>
                        {workspaceProgress?.next && <strong>Prossimo controllo: {workspaceProgress.next}</strong>}
                        {workspace.status !== 'SUCCEEDED' && workspaceProgress?.next && <button type="button" onClick={confirmGuidedStep} disabled={workspaceBusy}>{workspaceBusy ? 'Salvataggio…' : 'Conferma passaggio eseguito'}</button>}
                        {workspaceSummary && <pre>{workspaceSummary}</pre>}
                      </>
                    )}
                  </div>
                )}
                {message.suggestions?.length > 0 && (
                  <div className="randai__equipment">
                    <b>Suggerimenti ordinati</b>
                    {message.suggestions.map((item) => (
                      <div key={item.id} className="randai__equipment-item">
                        <strong>{item.title}</strong>
                        <span>{item.kind === 'procedure' ? 'Procedura' : 'Esperienza'} · {item.trust} · confidenza {Math.round((item.confidence || 0) * 100)}%</span>
                        {item.nextAction && <small>Prossima azione: {item.nextAction}</small>}
                        {item.caution && <small>{item.caution}</small>}
                      </div>
                    ))}
                  </div>
                )}
                {message.memory?.length > 0 && (
                  <div className="randai__equipment">
                    <b>Memoria RandAI verificata</b>
                    {message.memory.map((item) => (
                      <div key={item.id} className="randai__equipment-item">
                        <strong>{item.symptom}</strong>
                        {item.cause && <span>Causa confermata: {item.cause}</span>}
                        <small>Soluzione: {item.solution}</small>
                        <small>{item.confirmationCount || 1} conferma/e · {item.sourceLabel}</small>
                      </div>
                    ))}
                  </div>
                )}
                {message.procedure && (
                  <>
                    <span className="randai__source">Procedura interna · v{message.procedure.version || 1}</span>
                    <h3>{message.procedure.title}</h3>
                    <p>{message.procedure.summary}</p>
                    <ol>{(message.procedure.steps || []).map((step) => <li key={step}>{step}</li>)}</ol>
                  </>
                )}
                {message.equipment?.length > 0 && (
                  <div className="randai__equipment">
                    <b>Impianto collegato</b>
                    {message.equipment.map((item) => (
                      <div key={item.id} className="randai__equipment-item">
                        <strong>{item.name}</strong><span>{item.location}</span>
                        {item.description && <small>{item.description}</small>}
                        {item.randai_equipment_serves?.length > 0 && <small>Serve: {item.randai_equipment_serves.map((area) => area.served_area).join(', ')}</small>}
                      </div>
                    ))}
                  </div>
                )}
                {message.history?.length > 0 && (
                  <div className="randai__equipment">
                    <b>Storico RandApp correlato</b>
                    {message.history.map((item) => (
                      <div key={`${item.kind}-${item.id}`} className="randai__equipment-item">
                        <strong>{item.kind === 'intervento' ? 'Intervento' : 'Segnalazione'}{item.location ? ` · ${item.location}` : ''}</strong>
                        {item.category && <span>{item.category}{item.status ? ` · ${item.status}` : ''}</span>}
                        {item.text && <small>{item.text}</small>}
                      </div>
                    ))}
                  </div>
                )}
                {message.documents?.length > 0 && <small>Documentazione tecnica approvata trovata: {message.documents.length} riferimento/i.</small>}
                {message.procedure?.sourceLabel && <small>{message.procedure.sourceLabel}</small>}
                {message.procedure?.caution && <div className="randai__caution">{message.procedure.caution}</div>}
              </article>
            ) : (
              <div className="randai__bubble randai__bubble--assistant" key={`${index}-${message.text}`}>
                {audio.current?.capabilities.tts && <button type="button" className="randai__audio-action" onClick={() => readMessage(message)} aria-label="Leggi la risposta RandAI">🔊 Leggi</button>}
                <span className="randai__source">{message.kind === 'error' ? 'Base tecnica non disponibile' : 'Conoscenza insufficiente'}</span>
                <p>{message.text}</p>
              </div>
            ))}
            {busy && <div className="randai__bubble randai__bubble--assistant"><span className="randai__source">Controllo memoria e stato impianto…</span></div>}
          </div>

          <form className="randai__composer" onSubmit={submit}>
            {canDictate && <button type="button" className={`randai__dictate ${listening ? 'is-listening' : ''}`} onClick={startDictation} disabled={busy || listening} aria-pressed={listening} aria-label="Detta la domanda">{listening ? '●' : '🎙'}</button>}
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows="2" placeholder="Es. Camera 125 non fredda…" aria-label="Domanda a RandAI" disabled={busy} />
            <button type="submit" disabled={!query.trim() || busy}>{busy ? 'Controllo…' : 'Chiedi'}</button>
          </form>
          {audioNotice && <small className="randai__audio-notice" role="status">{audioNotice}</small>}
        </section>
      )}
    </div>
  )
}
