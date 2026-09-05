import { useState } from 'react'
import { askRandAIAboutGroup } from './randchat-ai.js'

export default function RandChatAI({ open, groupId, groupName, onClose }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null
  const ask = async (event) => {
    event.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true); setError(''); setResult(null)
    try { setResult(await askRandAIAboutGroup({ groupId, query })) }
    catch (e) { setError(e.message || 'RandAI non disponibile per questo gruppo') }
    finally { setBusy(false) }
  }
  const guidance = result?.guidance
  const procedure = guidance?.procedure
  const suggestions = guidance?.suggestions || []

  return <div className="rc-modal-backdrop" onClick={onClose}>
    <section className="rc-modal rc-ai-modal" onClick={(e) => e.stopPropagation()}>
      <header><div><h2>RandAI · {groupName || 'Gruppo'}</h2><small>Legge solo il contesto operativo autorizzato di questo gruppo. Mai i DM.</small></div><button className="rc-icon" onClick={onClose}>×</button></header>
      <form className="rc-create" onSubmit={ask}>
        <textarea rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Es. Qual è la procedura corretta? Cosa dobbiamo controllare?" maxLength={1000} autoFocus />
        <button disabled={busy || !query.trim()}>{busy ? 'Analizzo…' : 'Chiedi a RandAI'}</button>
      </form>
      {error && <div className="rc-error" role="alert">{error}</div>}
      {result && !guidance && <p className="rc-muted">Nessuna procedura o conoscenza approvata pertinente trovata.</p>}
      {guidance && <div className="rc-ai-result">
        {procedure && <article className="rc-procedure-card"><b>📘 {procedure.title}</b><p>{procedure.summary}</p>{procedure.caution && <small>⚠️ {procedure.caution}</small>}</article>}
        {suggestions.length > 0 && <div><b>Suggerimenti</b><ul>{suggestions.slice(0, 6).map((item, index) => <li key={`${index}-${String(item).slice(0,20)}`}>{typeof item === 'string' ? item : item?.title || item?.text || JSON.stringify(item)}</li>)}</ul></div>}
        <small className="rc-muted">Fonte: {guidance.source || 'conoscenza interna approvata'}</small>
      </div>}
    </section>
  </div>
}
