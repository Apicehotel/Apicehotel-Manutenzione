import { useEffect, useRef, useState } from 'react'
import ChatAttachment from './ChatAttachment.jsx'
import useRandChatScroll from './useRandChatScroll.js'

const fmtTime = (value) => {
  try { return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) } catch { return '' }
}

export default function RandChatThread({
  mode,
  threadId,
  activeGroup,
  activeThread,
  hotelLabel,
  members,
  messages,
  currentUserId,
  memberById,
  procedureByMessage,
  attachmentsByMessage,
  busy,
  error,
  dmRecipientHasDevice,
  canManageGroup,
  onBack,
  onSend,
  onOpenProcedures,
  onOpenAI,
  onOpenMembers,
  onChangeGroupRetention,
  onChangeDmRetention,
  onPromote,
  onDraftProcedure,
  onTogglePin,
}) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [messageMenuId, setMessageMenuId] = useState(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const composingRef = useRef(false)
  const mentionStartRef = useRef(-1)
  const { scrollRef, hitBottom, scrollToBottom, onScroll, followNextMessage } = useRandChatScroll({ threadId, messages })

  const title = mode === 'groups' ? activeGroup?.name : activeThread?.other_display_name
  const subtitle = mode === 'groups'
    ? `${hotelLabel} · ${members.length} membri`
    : '🔒 E2EE per dispositivo'

  useEffect(() => {
    setText('')
    setFiles([])
    setMenuOpen(false)
    setMessageMenuId(null)
    setMentionOpen(false)
    setMentionQuery('')
    mentionStartRef.current = -1
    if (fileRef.current) fileRef.current.value = ''
  }, [threadId])

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`
  }, [text])


  const mentionOptions = mode === 'groups'
    ? [
        { type: 'action', id: 'procedure', label: '@procedura', description: 'Condividi una procedura' },
        { type: 'action', id: 'randai', label: '@randai', description: 'Apri RandAI per il gruppo' },
        { type: 'action', id: 'members', label: '@membri', description: 'Apri elenco membri' },
        ...members
          .filter((member) => member.auth_user_id !== currentUserId)
          .map((member) => ({
            type: 'member',
            id: member.auth_user_id,
            label: '@' + String(member.display_name || 'utente').trim().replace(/\s+/g, '_'),
            displayName: member.display_name || 'Utente',
            description: member.group_role || 'membro',
          })),
      ]
    : []

  const filteredMentions = mentionOptions.filter((option) => {
    const needle = mentionQuery.trim().toLowerCase()
    if (!needle) return true
    return option.label.toLowerCase().includes('@' + needle)
      || String(option.displayName || option.description || '').toLowerCase().includes(needle)
  }).slice(0, 8)

  const updateMentionState = (value, caret) => {
    if (mode !== 'groups') {
      setMentionOpen(false)
      mentionStartRef.current = -1
      return
    }
    const beforeCaret = value.slice(0, caret)
    const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/)
    if (!match) {
      setMentionOpen(false)
      setMentionQuery('')
      mentionStartRef.current = -1
      return
    }
    const atIndex = beforeCaret.lastIndexOf('@')
    mentionStartRef.current = atIndex
    setMentionQuery(match[1] || '')
    setMentionOpen(true)
  }

  const chooseMention = (option) => {
    const node = textareaRef.current
    const start = mentionStartRef.current
    const caret = node?.selectionStart ?? text.length
    if (start < 0) return

    if (option.type === 'action') {
      const next = text.slice(0, start) + text.slice(caret)
      setText(next)
      setMentionOpen(false)
      setMentionQuery('')
      mentionStartRef.current = -1
      requestAnimationFrame(() => node?.focus())
      if (option.id === 'procedure') onOpenProcedures()
      if (option.id === 'randai') onOpenAI()
      if (option.id === 'members') onOpenMembers()
      return
    }

    const token = option.label + ' '
    const next = text.slice(0, start) + token + text.slice(caret)
    setText(next)
    setMentionOpen(false)
    setMentionQuery('')
    mentionStartRef.current = -1
    requestAnimationFrame(() => {
      if (!node) return
      node.focus()
      const pos = start + token.length
      node.setSelectionRange(pos, pos)
    })
  }

  const renderMessageText = (body) => {
    const parts = String(body || '').split(/(@[A-Za-z0-9_À-ÿ.-]+)/g)
    return parts.map((part, index) => part.startsWith('@')
      ? <mark className="randchat-mention" key={`${part}-${index}`}>{part}</mark>
      : <span key={`text-${index}`}>{part}</span>)
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    const body = text.trim()
    const selectedFiles = Array.from(files || [])
    if ((!body && !selectedFiles.length) || busy || (mode === 'dm' && !dmRecipientHasDevice)) return
    followNextMessage()
    const ok = await onSend(body, selectedFiles)
    if (!ok) return
    setText('')
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    requestAnimationFrame(() => scrollToBottom('smooth'))
  }

  const onKeyDown = (event) => {
    if (event.keyCode === 229 || event.nativeEvent?.isComposing || composingRef.current) return
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      submit(event)
    }
  }

  return <section className="randchat-thread" data-testid="randchat-thread">
    <header className="randchat-thread__head">
      <button className="randchat-back" onClick={onBack} aria-label="Torna alle conversazioni">‹</button>
      <div className="randchat-thread__title">
        <h2>{title}</h2>
        <small>{subtitle}</small>
      </div>
      <div className="randchat-menu-wrap">
        <button className="randchat-iconbtn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu conversazione" aria-expanded={menuOpen}>⋯</button>
        {menuOpen && <div className="randchat-menu">
          {mode === 'groups' ? <>
            <button onClick={() => { setMenuOpen(false); onOpenMembers() }}>👥 Membri</button>
            {canManageGroup && <label>Storico
              <select value={activeGroup?.retention_days || 30} onChange={(e) => onChangeGroupRetention(Number(e.target.value))} disabled={busy}>
                <option value={30}>30 giorni</option>
                <option value={60}>60 giorni</option>
              </select>
            </label>}
          </> : <>
            <span className="randchat-menu__note">🔒 Firma e cifratura verificate sul dispositivo</span>
            <label>Storico
              <select value={activeThread?.retention_days || 7} onChange={(e) => onChangeDmRetention(Number(e.target.value))} disabled={busy}>
                <option value={1}>1 giorno</option>
                <option value={7}>7 giorni</option>
                <option value={15}>15 giorni</option>
              </select>
            </label>
          </>}
        </div>}
      </div>
    </header>

    <div className="randchat-thread__notices">
      {error && <div className="randchat-banner randchat-banner--error">{error}</div>}
      {mode === 'dm' && !dmRecipientHasDevice && (
        <div className="randchat-banner">Il destinatario deve aprire RandChat almeno una volta su un dispositivo.</div>
      )}
    </div>

    <div className="randchat-messages" ref={scrollRef} onScroll={onScroll}>
      {messages.map((message) => {
        const own = message.sender_user_id === currentUserId
        const sender = mode === 'groups'
          ? memberById.get(message.sender_user_id)?.display_name || 'Utente'
          : activeThread?.other_display_name || 'Utente'
        const procedureLink = mode === 'groups' ? procedureByMessage.get(message.id) : null
        const procedure = procedureLink?.procedure_snapshot
        const media = mode === 'groups' ? attachmentsByMessage.get(message.id) || [] : message.attachments || []

        return <article key={message.id} className={`randchat-bubble ${own ? 'own' : ''} ${message.pinned_at ? 'pinned' : ''}`}>
          <div className="randchat-bubble__meta">
            <b>{own ? 'Tu' : sender}</b>
            <time>{fmtTime(message.created_at)}</time>
            {message.pinned_at && <span>📌</span>}
            {mode === 'dm' && <span title={message.cryptoState === 'verified' ? 'Firma e cifratura verificate' : 'Messaggio non verificato'}>{message.cryptoState === 'verified' ? '🔒' : '⚠️'}</span>}
          </div>
          {message.body && <p>{renderMessageText(message.body)}</p>}
          {procedure && <div className="randchat-procedure">
            <b>📘 {procedure.title}</b>
            <small>{procedure.category || 'Generale'} · v{procedureLink.procedure_version}</small>
            <p>{procedure.summary}</p>
            {procedure.caution && <small>⚠️ {procedure.caution}</small>}
          </div>}
          {media.map((attachment) => <ChatAttachment key={attachment.id} attachment={attachment} encrypted={mode === 'dm'} />)}

          <button className="randchat-message-menu-trigger" onClick={() => setMessageMenuId((id) => id === message.id ? null : message.id)} aria-label="Azioni messaggio">⋯</button>
          {messageMenuId === message.id && <div className="randchat-message-menu">
            <button onClick={() => { setMessageMenuId(null); onPromote(message) }}>Crea segnalazione</button>
            {mode === 'groups' && !procedure && message.body && <button onClick={() => { setMessageMenuId(null); onDraftProcedure(message) }}>Bozza procedura</button>}
            {mode === 'groups' && canManageGroup && <button onClick={() => { setMessageMenuId(null); onTogglePin(message) }}>{message.pinned_at ? 'Sblocca' : 'Conserva'}</button>}
          </div>}
        </article>
      })}
      {!messages.length && <div className="randchat-empty">Ancora nessun messaggio.</div>}
    </div>

    {!hitBottom && <button className="randchat-to-bottom" onClick={() => scrollToBottom('smooth')} aria-label="Vai agli ultimi messaggi">↓</button>}

    <form className="randchat-input-panel" onSubmit={submit}>
      <label className="randchat-attach" aria-label="Allega file">＋
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
      </label>
      <div className="randchat-input-wrap">
        <textarea
          ref={textareaRef}
          rows={1}
          maxLength={8000}
          value={text}
          placeholder={mode === 'groups' ? 'Messaggio' : 'Messaggio privato'}
          onChange={(e) => {
            setText(e.target.value)
            updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length)
          }}
          onClick={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
          onKeyUp={(e) => {
            if (['ArrowUp', 'ArrowDown', 'Escape', 'Enter'].includes(e.key)) return
            updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mentionOpen) {
              e.preventDefault()
              setMentionOpen(false)
              return
            }
            onKeyDown(e)
          }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
        />
        {!!files.length && <small>{files.length} allegat{files.length === 1 ? 'o' : 'i'}</small>}
        {mentionOpen && <div className="randchat-mention-picker" role="listbox" aria-label="Comandi e menzioni">
          {filteredMentions.map((option) => <button type="button" key={`${option.type}-${option.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseMention(option)}>
            <b>{option.label}</b>
            <small>{option.type === 'member' ? option.displayName : option.description}</small>
          </button>)}
          {!filteredMentions.length && <span>Nessun risultato</span>}
        </div>}
      </div>
      <button className="randchat-send" disabled={busy || (!text.trim() && !files.length) || (mode === 'dm' && !dmRecipientHasDevice)}>Invia</button>
    </form>
  </section>
}
