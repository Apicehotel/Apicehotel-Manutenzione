import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hotelById } from '../helpers.js'
import {
  addChatGroupMember,
  createChatGroup,
  fetchChatDirectory,
  fetchChatGroupMembers,
  fetchChatGroups,
  fetchChatMessages,
  fetchGroupProcedureLinks,
  sendChatMessage,
  subscribeChatGroup,
} from './chat-data.js'
import {
  ensureRegisteredDmDevice,
  fetchDmDevices,
  fetchDmDirectory,
  fetchDmMessages,
  fetchDmThreads,
  openDmThread,
  sendDmMessage,
  subscribeDmThread,
} from './dm-data.js'
import {
  cleanupRandMediaUploads,
  fetchGroupAttachments,
  registerGroupAttachment,
  subscribeChatAttachments,
  uploadGroupMediaFiles,
} from './randmedia.js'
import ChatAttachment from './ChatAttachment.jsx'
import ProcedureDraftDialog from './ProcedureDraftDialog.jsx'
import ProcedurePicker from './ProcedurePicker.jsx'
import PromoteIssueDialog from './PromoteIssueDialog.jsx'
import RandChatAI from './RandChatAI.jsx'
import './randchat-next.css'

const fmtTime = (value) => {
  try { return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) } catch { return '' }
}

export default function RandChat({ user, hotel }) {
  const currentUserId = user?.auth_user_id || user?.id
  const [mode, setMode] = useState('groups')
  const [groups, setGroups] = useState([])
  const [threads, setThreads] = useState([])
  const [directory, setDirectory] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [devices, setDevices] = useState([])
  const [attachments, setAttachments] = useState([])
  const [procedureLinks, setProcedureLinks] = useState([])
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cryptoReady, setCryptoReady] = useState(false)
  const [newRecipient, setNewRecipient] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [showThreadMenu, setShowThreadMenu] = useState(false)
  const [messageMenuId, setMessageMenuId] = useState(null)
  const [showMembers, setShowMembers] = useState(false)
  const [inviteId, setInviteId] = useState('')
  const [showProcedures, setShowProcedures] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [promoteMessage, setPromoteMessage] = useState(null)
  const [draftMessage, setDraftMessage] = useState(null)
  const [showJump, setShowJump] = useState(false)
  const fileRef = useRef(null)
  const messagesRef = useRef(null)
  const endRef = useRef(null)
  const followBottomRef = useRef(true)

  const activeGroup = useMemo(() => mode === 'groups' ? groups.find((g) => g.id === activeId) || null : null, [mode, groups, activeId])
  const activeThread = useMemo(() => mode === 'dm' ? threads.find((t) => t.id === activeId) || null : null, [mode, threads, activeId])
  const active = activeGroup || activeThread
  const isThreadOpen = Boolean(activeId && active)
  const memberById = useMemo(() => new Map(members.map((m) => [m.auth_user_id, m])), [members])
  const procedureByMessage = useMemo(() => new Map(procedureLinks.map((x) => [x.group_message_id, x])), [procedureLinks])
  const attachmentsByMessage = useMemo(() => {
    const map = new Map()
    attachments.forEach((item) => map.set(item.group_message_id, [...(map.get(item.group_message_id) || []), item]))
    return map
  }, [attachments])

  const loadLists = useCallback(async () => {
    if (!user?.chat_enabled) return
    const [groupRows, threadRows] = await Promise.all([fetchChatGroups(), fetchDmThreads().catch(() => [])])
    setGroups(groupRows)
    setThreads(threadRows)
  }, [user?.chat_enabled])

  useEffect(() => {
    if (!user?.chat_enabled) return
    let alive = true
    ;(async () => {
      try {
        await ensureRegisteredDmDevice(currentUserId)
        const [groupRows, threadRows, dirRows] = await Promise.all([
          fetchChatGroups(),
          fetchDmThreads(),
          fetchDmDirectory(),
        ])
        if (!alive) return
        setGroups(groupRows)
        setThreads(threadRows)
        setDirectory(dirRows)
        setCryptoReady(true)
      } catch (e) {
        if (alive) setError(e?.message || 'RandChat non disponibile')
      }
    })()
    return () => { alive = false }
  }, [currentUserId, user?.chat_enabled])

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setMessages([]); setMembers([]); setDevices([]); setAttachments([]); setProcedureLinks([])
      return
    }
    if (mode === 'groups') {
      const [msg, mem, media, procedures] = await Promise.all([
        fetchChatMessages(activeId),
        fetchChatGroupMembers(activeId),
        fetchGroupAttachments(activeId),
        fetchGroupProcedureLinks(activeId),
      ])
      setMessages(msg); setMembers(mem); setAttachments(media); setProcedureLinks(procedures); setDevices([])
    } else {
      const [{ messages: msg }, deviceRows] = await Promise.all([
        fetchDmMessages(activeId, currentUserId),
        fetchDmDevices(activeId),
      ])
      setMessages(msg); setDevices(deviceRows); setMembers([]); setAttachments([]); setProcedureLinks([])
    }
  }, [activeId, mode, currentUserId])

  useEffect(() => { loadThread().catch((e) => setError(e?.message || 'Conversazione non disponibile')) }, [loadThread])

  useEffect(() => {
    if (!activeId) return undefined
    if (mode === 'groups') {
      const unsubChat = subscribeChatGroup(activeId, {
        onMessage: () => loadThread().catch(() => {}),
        onMessageChange: () => loadThread().catch(() => {}),
        onMembershipChange: () => loadThread().catch(() => {}),
      })
      const unsubMedia = subscribeChatAttachments(activeId, () => loadThread().catch(() => {}))
      return () => { unsubChat(); unsubMedia() }
    }
    return subscribeDmThread(activeId, () => {
      loadThread().catch(() => {})
      loadLists().catch(() => {})
    })
  }, [activeId, mode, loadThread, loadLists])

  const scrollToBottom = useCallback((behavior = 'auto') => {
    followBottomRef.current = true
    setShowJump(false)
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior, block: 'end' }))
  }, [])

  useEffect(() => {
    if (!activeId || !messages.length) return
    if (followBottomRef.current) scrollToBottom(messages.length > 1 ? 'smooth' : 'auto')
    else setShowJump(true)
  }, [activeId, messages, scrollToBottom])

  const handleScroll = () => {
    const node = messagesRef.current
    if (!node) return
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 96
    followBottomRef.current = nearBottom
    setShowJump(!nearBottom)
  }

  const openConversation = (id) => {
    followBottomRef.current = true
    setShowJump(false)
    setShowThreadMenu(false)
    setMessageMenuId(null)
    setActiveId(id)
  }

  const backToList = () => {
    setActiveId(null)
    setMessages([])
    setShowThreadMenu(false)
    setMessageMenuId(null)
  }

  const switchMode = (next) => {
    backToList()
    setMode(next)
  }

  const send = async (event) => {
    event.preventDefault()
    const body = text.trim()
    const selectedFiles = Array.from(files || [])
    if ((!body && !selectedFiles.length) || !activeId || busy) return
    followBottomRef.current = true
    setBusy(true); setError('')
    try {
      if (mode === 'groups') {
        const message = await sendChatMessage(activeId, currentUserId, body || `📎 ${selectedFiles.length} allegati`)
        let uploaded = []
        try {
          if (selectedFiles.length) {
            uploaded = await uploadGroupMediaFiles(selectedFiles, { groupId: activeId, messageId: message.id })
            for (const attachment of uploaded) await registerGroupAttachment({ groupId: activeId, messageId: message.id, attachment })
          }
        } catch (e) {
          await cleanupRandMediaUploads(uploaded)
          throw e
        }
      } else {
        await sendDmMessage({ threadId: activeId, userId: currentUserId, body, files: selectedFiles })
      }
      setText(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      await loadThread(); await loadLists()
      scrollToBottom('smooth')
    } catch (e) {
      setError(e?.message || 'Invio non riuscito')
    } finally {
      setBusy(false)
    }
  }

  const createGroupNow = async () => {
    const name = newGroupName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const id = await createChatGroup({ hotelId: hotel.id, name, retentionDays: 30 })
      setNewGroupName(''); setShowNewGroup(false)
      await loadLists(); setMode('groups'); openConversation(id)
    } catch (e) { setError(e?.message || 'Creazione gruppo non riuscita') }
    finally { setBusy(false) }
  }

  const startDm = async () => {
    if (!newRecipient || busy) return
    setBusy(true)
    try {
      const id = await openDmThread(newRecipient)
      setNewRecipient('')
      await loadLists(); setMode('dm'); openConversation(id)
    } catch (e) { setError(e?.message || 'Impossibile aprire il diretto') }
    finally { setBusy(false) }
  }

  const inviteMember = async () => {
    if (!inviteId || !activeId || busy) return
    setBusy(true)
    try {
      await addChatGroupMember(activeId, inviteId, 'member')
      setInviteId('')
      await loadThread()
    } catch (e) { setError(e?.message || 'Invito non riuscito') }
    finally { setBusy(false) }
  }

  if (!user?.chat_enabled) {
    return <section className="rnc-empty"><h2>RandChat non abilitata</h2><p>Un amministratore può abilitarla dal pannello Utenti.</p></section>
  }

  const listItems = mode === 'groups' ? groups : threads
  const dmRecipientHasDevice = mode !== 'dm' || !activeThread || devices.some((d) => d.auth_user_id === activeThread.other_user_id)

  return <section className={`rnc-root ${isThreadOpen ? 'rnc-root--thread' : 'rnc-root--list'}`} data-testid="randchat-next">
    {!isThreadOpen ? <div className="rnc-list-screen">
      <header className="rnc-list-header">
        <div><h1>RandChat</h1><small>Messaggistica interna</small></div>
        {mode === 'groups' && <button className="rnc-round" onClick={() => setShowNewGroup((v) => !v)} aria-label="Nuovo gruppo">＋</button>}
      </header>

      <nav className="rnc-tabs" aria-label="Tipo conversazione">
        <button className={mode === 'groups' ? 'active' : ''} onClick={() => switchMode('groups')}>Gruppi</button>
        <button className={mode === 'dm' ? 'active' : ''} onClick={() => switchMode('dm')}>🔒 Diretti</button>
      </nav>

      {mode === 'groups' && showNewGroup && <div className="rnc-new-row">
        <input value={newGroupName} placeholder="Nome gruppo" onChange={(e) => setNewGroupName(e.target.value)} autoFocus />
        <button onClick={createGroupNow} disabled={!newGroupName.trim() || busy}>Crea</button>
      </div>}

      {mode === 'dm' && <div className="rnc-new-row">
        <select value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} disabled={!cryptoReady || busy}>
          <option value="">Nuovo diretto…</option>
          {directory.filter((x) => x.auth_user_id !== currentUserId).map((x) => <option key={x.auth_user_id} value={x.auth_user_id}>{x.display_name}</option>)}
        </select>
        <button onClick={startDm} disabled={!newRecipient || busy}>Apri</button>
      </div>}

      {error && <div className="rnc-banner rnc-banner--error">{error}</div>}

      <div className="rnc-conversation-list">
        {listItems.map((item) => {
          const title = mode === 'groups' ? item.name : item.other_display_name
          const subtitle = mode === 'groups'
            ? `${hotelById(item.hotel_id)?.name || item.hotel_id} · ${item.retention_days} gg`
            : `🔒 E2EE · ${item.retention_days} gg`
          return <button key={item.id} className="rnc-list-item" onClick={() => openConversation(item.id)}>
            <span className="rnc-avatar">{mode === 'groups' ? '#' : '🔒'}</span>
            <span><b>{title}</b><small>{subtitle}</small></span>
            <span className="rnc-chevron">›</span>
          </button>
        })}
        {!listItems.length && <div className="rnc-empty">Nessuna conversazione.</div>}
      </div>
    </div> : <div className="rnc-thread">
      <header className="rnc-thread-header">
        <button className="rnc-back" onClick={backToList} aria-label="Indietro">‹</button>
        <div className="rnc-thread-title">
          <h2>{mode === 'groups' ? activeGroup?.name : activeThread?.other_display_name}</h2>
          <small>{mode === 'groups' ? `${hotelById(activeGroup?.hotel_id)?.name || activeGroup?.hotel_id} · ${members.length} membri` : '🔒 E2EE per dispositivo'}</small>
        </div>
        <div className="rnc-menu-wrap">
          <button className="rnc-round" onClick={() => setShowThreadMenu((v) => !v)} aria-label="Menu conversazione">⋯</button>
          {showThreadMenu && <div className="rnc-menu">
            {mode === 'groups' && <>
              <button onClick={() => { setShowThreadMenu(false); setShowProcedures(true) }}>📘 Procedure</button>
              <button onClick={() => { setShowThreadMenu(false); setShowAI(true) }}>✨ RandAI</button>
              <button onClick={() => { setShowThreadMenu(false); setShowMembers(true) }}>👥 Membri</button>
            </>}
            {mode === 'dm' && <span className="rnc-menu-note">🔒 Messaggi cifrati end-to-end</span>}
          </div>}
        </div>
      </header>

      {error && <div className="rnc-banner rnc-banner--error">{error}</div>}
      {mode === 'dm' && !dmRecipientHasDevice && <div className="rnc-banner">Il destinatario deve aprire RandChat almeno una volta su un dispositivo.</div>}

      <div className="rnc-messages" ref={messagesRef} onScroll={handleScroll}>
        {messages.map((message) => {
          const own = message.sender_user_id === currentUserId
          const sender = mode === 'groups' ? memberById.get(message.sender_user_id)?.display_name || 'Utente' : activeThread?.other_display_name
          const procedureLink = mode === 'groups' ? procedureByMessage.get(message.id) : null
          const procedure = procedureLink?.procedure_snapshot
          const media = mode === 'groups' ? attachmentsByMessage.get(message.id) || [] : message.attachments || []
          return <article key={message.id} className={`rnc-bubble ${own ? 'own' : ''}`}>
            <div className="rnc-meta"><b>{own ? 'Tu' : sender}</b><time>{fmtTime(message.created_at)}</time>{mode === 'dm' && <span>{message.cryptoState === 'verified' ? '🔒' : '⚠️'}</span>}</div>
            {message.body && <p>{message.body}</p>}
            {procedure && <div className="rnc-procedure"><b>📘 {procedure.title}</b><p>{procedure.summary}</p></div>}
            {media.map((attachment) => <ChatAttachment key={attachment.id} attachment={attachment} encrypted={mode === 'dm'} />)}
            <button className="rnc-message-menu-trigger" onClick={() => setMessageMenuId((id) => id === message.id ? null : message.id)} aria-label="Azioni messaggio">⋯</button>
            {messageMenuId === message.id && <div className="rnc-message-menu">
              <button onClick={() => { setMessageMenuId(null); setPromoteMessage(message) }}>Crea segnalazione</button>
              {mode === 'groups' && !procedure && message.body && <button onClick={() => { setMessageMenuId(null); setDraftMessage(message) }}>Bozza procedura</button>}
            </div>}
          </article>
        })}
        {!messages.length && <div className="rnc-empty">Ancora nessun messaggio.</div>}
        <div ref={endRef} className="rnc-end" aria-hidden="true" />
      </div>

      {showJump && <button className="rnc-jump" onClick={() => scrollToBottom('smooth')} aria-label="Vai agli ultimi messaggi">↓</button>}

      <form className="rnc-composer" onSubmit={send}>
        <label className="rnc-attach" aria-label="Allega file">＋
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        <div className="rnc-input-wrap">
          <textarea rows={1} maxLength={8000} value={text} placeholder={mode === 'groups' ? 'Messaggio' : 'Messaggio privato'} onChange={(e) => setText(e.target.value)} />
          {!!files.length && <small>{files.length} allegat{files.length === 1 ? 'o' : 'i'}</small>}
        </div>
        <button className="rnc-send" disabled={busy || (!text.trim() && !files.length) || (mode === 'dm' && !dmRecipientHasDevice)}>Invia</button>
      </form>
    </div>}

    {showMembers && mode === 'groups' && activeGroup && <div className="rnc-modal-backdrop" onClick={() => setShowMembers(false)}>
      <section className="rnc-modal" onClick={(e) => e.stopPropagation()}>
        <header><h3>Membri · {activeGroup.name}</h3><button onClick={() => setShowMembers(false)}>×</button></header>
        <div className="rnc-members">{members.map((m) => <div key={m.auth_user_id}><b>{m.display_name}</b><small>{m.group_role}</small></div>)}</div>
        <div className="rnc-new-row">
          <select value={inviteId} onChange={(e) => setInviteId(e.target.value)}>
            <option value="">Aggiungi utente…</option>
            {directory.filter((x) => !members.some((m) => m.auth_user_id === x.auth_user_id)).map((x) => <option key={x.auth_user_id} value={x.auth_user_id}>{x.display_name}</option>)}
          </select>
          <button onClick={inviteMember} disabled={!inviteId || busy}>Aggiungi</button>
        </div>
      </section>
    </div>}

    <ProcedurePicker open={showProcedures && mode === 'groups' && Boolean(activeGroup)} groupId={activeId} onClose={() => setShowProcedures(false)} onShared={() => loadThread().catch(() => {})} />
    <ProcedureDraftDialog open={Boolean(draftMessage && activeGroup)} groupId={activeId} hotelId={activeGroup?.hotel_id} message={draftMessage} onClose={() => setDraftMessage(null)} />
    <RandChatAI open={showAI && mode === 'groups' && Boolean(activeGroup)} groupId={activeId} groupName={activeGroup?.name} onClose={() => setShowAI(false)} />
    <PromoteIssueDialog open={Boolean(promoteMessage)} onClose={() => setPromoteMessage(null)} user={user} hotel={hotel} text={promoteMessage?.body || ''} source={promoteMessage ? { type: mode === 'groups' ? 'group' : 'dm', id: activeId, messageId: promoteMessage.id } : null} onPromoted={() => setPromoteMessage(null)} />
  </section>
}
