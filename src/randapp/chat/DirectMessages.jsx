import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureRegisteredDmDevice,
  fetchDmDevices,
  fetchDmDirectory,
  fetchDmMessages,
  fetchDmThreads,
  openDmThread,
  sendDmMessage,
  setDmRetention,
  subscribeDmThread,
} from './dm-data.js'
import PromoteIssueDialog from './PromoteIssueDialog.jsx'

const fmtTime = (value) => {
  try { return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(value)) } catch { return '' }
}

export default function DirectMessages({ user, hotel }) {
  const currentUserId = user?.auth_user_id || user?.id
  const [threads, setThreads] = useState([])
  const [directory, setDirectory] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [devices, setDevices] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cryptoReady, setCryptoReady] = useState(false)
  const [newRecipient, setNewRecipient] = useState('')
  const [promoteMessage, setPromoteMessage] = useState(null)

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId])
  const directoryOptions = useMemo(() => directory.filter((entry) => entry.auth_user_id !== currentUserId), [directory, currentUserId])
  const recipientHasDevice = useMemo(() => {
    if (!selected) return false
    return devices.some((device) => device.auth_user_id === selected.other_user_id)
  }, [devices, selected])

  const loadThreads = useCallback(async () => {
    const rows = await fetchDmThreads()
    setThreads(rows)
    setSelectedId((current) => current && rows.some((thread) => thread.id === current) ? current : null)
  }, [])

  const loadSelected = useCallback(async () => {
    if (!selectedId) { setMessages([]); setDevices([]); return }
    const [{ messages: rows }, deviceRows] = await Promise.all([
      fetchDmMessages(selectedId, currentUserId),
      fetchDmDevices(selectedId),
    ])
    setMessages(rows)
    setDevices(deviceRows)
  }, [selectedId, currentUserId])

  useEffect(() => {
    let active = true
    const boot = async () => {
      try {
        await ensureRegisteredDmDevice(currentUserId)
        const [threadRows, directoryRows] = await Promise.all([fetchDmThreads(), fetchDmDirectory()])
        if (!active) return
        setThreads(threadRows); setDirectory(directoryRows); setCryptoReady(true)
      } catch (err) {
        if (active) setError(err?.message || 'Crittografia DM non disponibile')
      }
    }
    boot()
    return () => { active = false }
  }, [currentUserId])

  useEffect(() => { loadSelected().catch((err) => setError(err?.message || 'DM non disponibili')) }, [loadSelected])
  useEffect(() => {
    if (!selectedId) return undefined
    return subscribeDmThread(selectedId, () => {
      loadSelected().catch(() => {})
      loadThreads().catch(() => {})
    })
  }, [selectedId, loadSelected, loadThreads])

  const startDm = async () => {
    if (!newRecipient || busy) return
    setBusy(true); setError('')
    try {
      const id = await openDmThread(newRecipient)
      setNewRecipient('')
      await loadThreads()
      setSelectedId(id)
    } catch (err) { setError(err?.message || 'Impossibile aprire il DM') }
    finally { setBusy(false) }
  }

  const send = async (event) => {
    event.preventDefault()
    const body = text.trim()
    if (!body || !selectedId || busy) return
    setText(''); setBusy(true); setError('')
    try {
      await sendDmMessage({ threadId: selectedId, userId: currentUserId, body })
      await loadSelected()
      await loadThreads()
    } catch (err) {
      setText(body)
      setError(err?.message || 'Invio E2EE non riuscito')
    } finally { setBusy(false) }
  }

  const changeRetention = async (days) => {
    if (!selected || busy) return
    setBusy(true); setError('')
    try { await setDmRetention(selected.id, Number(days)); await loadThreads(); await loadSelected() }
    catch (err) { setError(err?.message || 'Retention DM non aggiornata') }
    finally { setBusy(false) }
  }

  if (!cryptoReady && !error) return <div className="rc-empty"><h2>Preparo la cifratura…</h2><p>Le chiavi private restano su questo dispositivo.</p></div>

  return <section className="rc-dm" data-testid="randchat-dm">
    <aside className={`rc-groups ${selected ? 'rc-groups--has-selection' : ''}`}>
      <header className="rc-head"><div><h1>Messaggi diretti</h1><small>🔒 E2EE per dispositivo</small></div></header>
      <div className="rc-dm-new">
        <select value={newRecipient} onChange={(event) => setNewRecipient(event.target.value)} disabled={!cryptoReady || busy}>
          <option value="">Nuovo DM…</option>
          {directoryOptions.map((entry) => <option key={entry.auth_user_id} value={entry.auth_user_id}>{entry.display_name}</option>)}
        </select>
        <button onClick={startDm} disabled={!newRecipient || busy}>Apri</button>
      </div>
      <div className="rc-list">
        {threads.map((thread) => <button key={thread.id} className={`rc-group ${selectedId === thread.id ? 'active' : ''}`} onClick={() => setSelectedId(thread.id)}>
          <span className="rc-avatar">🔒</span><span><b>{thread.other_display_name}</b><small>{thread.retention_days} gg · E2EE</small></span>
        </button>)}
        {!threads.length && <p className="rc-muted">Nessun messaggio diretto.</p>}
      </div>
    </aside>

    <div className="rc-conversation">
      {!selected ? <div className="rc-empty"><h2>DM privati</h2><p>Il server conserva solo testo cifrato. Scegli una persona per iniziare.</p>{error && <div className="rc-error">{error}</div>}</div> : <>
        <header className="rc-conversation__head">
          <button className="rc-back" onClick={() => setSelectedId(null)}>‹</button>
          <div><h2>{selected.other_display_name}</h2><small>🔒 E2EE · cancellazione {selected.retention_days} giorni</small></div>
          <label className="rc-dm-retention">Storico <select value={selected.retention_days} onChange={(event) => changeRetention(event.target.value)} disabled={busy}><option value={1}>1 g</option><option value={7}>7 gg</option><option value={15}>15 gg</option></select></label>
        </header>
        {!recipientHasDevice && <div className="rc-warning">Il destinatario deve aprire RandChat almeno una volta su un dispositivo prima di poter ricevere nuovi DM E2EE.</div>}
        {error && <div className="rc-error" role="alert">{error}</div>}
        <div className="rc-messages">
          {messages.map((message) => {
            const own = message.sender_user_id === currentUserId
            return <article key={message.id} className={`rc-message ${own ? 'own' : ''} rc-message--${message.cryptoState}`}>
              <div className="rc-message__meta"><b>{own ? 'Tu' : selected.other_display_name}</b><time>{fmtTime(message.created_at)}</time><span title={message.cryptoState === 'verified' ? 'Firma e cifratura verificate' : 'Messaggio non verificato'}>{message.cryptoState === 'verified' ? '🔒' : '⚠️'}</span></div>
              <p>{message.body}</p>
              {message.cryptoState === 'verified' && <button className="rc-message__pin" onClick={() => setPromoteMessage(message)}>Crea segnalazione</button>}
            </article>
          })}
          {!messages.length && <p className="rc-muted rc-center">Ancora nessun messaggio.</p>}
        </div>
        <form className="rc-composer" onSubmit={send}><textarea value={text} maxLength={8000} rows={1} placeholder={`Messaggio privato a ${selected.other_display_name}`} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} /><button disabled={busy || !text.trim() || !recipientHasDevice}>Invia</button></form>
      </>}
    </div>

    <PromoteIssueDialog
      open={Boolean(promoteMessage)}
      onClose={() => setPromoteMessage(null)}
      user={user}
      hotel={hotel}
      text={promoteMessage?.body || ''}
      source={promoteMessage ? { type: 'dm', id: selectedId, messageId: promoteMessage.id } : null}
      onPromoted={() => setPromoteMessage(null)}
    />
  </section>
}
