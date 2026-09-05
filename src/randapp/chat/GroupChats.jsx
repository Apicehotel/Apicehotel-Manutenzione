import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hotelById } from '../helpers.js'
import {
  addChatGroupMember,
  createChatGroup,
  deleteChatMessage,
  fetchChatDirectory,
  fetchChatGroupMembers,
  fetchChatGroups,
  fetchChatMessages,
  fetchGroupProcedureLinks,
  removeChatGroupMember,
  sendChatMessage,
  setChatGroupMemberRole,
  setChatMessagePinned,
  subscribeChatGroup,
  updateChatGroup,
} from './chat-data.js'
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
import './chat.css'

const roleRank = { owner: 0, admin: 1, member: 2 }
const fmtTime = (value) => {
  try { return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(value)) } catch { return '' }
}
const displayHotels = (ids = []) => ids.map((id) => hotelById(id)?.name || id).join(' · ')

export default function GroupChats({ user, hotel }) {
  const currentUserId = user?.auth_user_id || user?.id
  const fileRef = useRef(null)
  const [groups, setGroups] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [directory, setDirectory] = useState([])
  const [attachments, setAttachments] = useState([])
  const [procedureLinks, setProcedureLinks] = useState([])
  const [files, setFiles] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showProcedures, setShowProcedures] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', retention: 30 })
  const [inviteId, setInviteId] = useState('')
  const [promoteMessage, setPromoteMessage] = useState(null)
  const [draftMessage, setDraftMessage] = useState(null)

  const selected = useMemo(() => groups.find((g) => g.id === selectedId) || null, [groups, selectedId])
  const me = useMemo(() => members.find((m) => m.auth_user_id === currentUserId) || null, [members, currentUserId])
  const canManage = Boolean(me && (me.group_role === 'owner' || me.group_role === 'admin'))
  const canCreate = Boolean(user?.chat_can_create_groups || user?.can_admin)
  const memberById = useMemo(() => new Map(members.map((m) => [m.auth_user_id, m])), [members])
  const invitedIds = useMemo(() => new Set(members.map((m) => m.auth_user_id)), [members])
  const inviteOptions = useMemo(() => directory.filter((u) => !invitedIds.has(u.auth_user_id)), [directory, invitedIds])
  const attachmentsByMessage = useMemo(() => {
    const map = new Map()
    attachments.forEach((item) => map.set(item.group_message_id, [...(map.get(item.group_message_id) || []), item]))
    return map
  }, [attachments])
  const procedureByMessage = useMemo(() => new Map(procedureLinks.map((item) => [item.group_message_id, item])), [procedureLinks])

  const loadGroups = useCallback(async () => {
    if (!user?.chat_enabled) return
    const rows = await fetchChatGroups()
    setGroups(rows)
    setSelectedId((current) => current && rows.some((g) => g.id === current) ? current : rows[0]?.id || null)
  }, [user?.chat_enabled])

  const loadSelected = useCallback(async () => {
    if (!selectedId) { setMessages([]); setMembers([]); setAttachments([]); setProcedureLinks([]); return }
    const [msg, mem, media, procedures] = await Promise.all([
      fetchChatMessages(selectedId),
      fetchChatGroupMembers(selectedId),
      fetchGroupAttachments(selectedId),
      fetchGroupProcedureLinks(selectedId),
    ])
    setMessages(msg)
    setMembers(mem.sort((a, b) => (roleRank[a.group_role] ?? 9) - (roleRank[b.group_role] ?? 9) || String(a.display_name).localeCompare(String(b.display_name), 'it')))
    setAttachments(media)
    setProcedureLinks(procedures)
  }, [selectedId])

  useEffect(() => { loadGroups().catch((e) => setError(e.message || 'Errore caricamento chat')) }, [loadGroups])
  useEffect(() => { loadSelected().catch((e) => setError(e.message || 'Errore caricamento gruppo')) }, [loadSelected])
  useEffect(() => {
    if (!selectedId) return undefined
    const unsubscribeChat = subscribeChatGroup(selectedId, {
      onMessage: () => loadSelected().catch(() => {}),
      onMessageChange: () => loadSelected().catch(() => {}),
      onMembershipChange: () => loadSelected().catch(() => {}),
    })
    const unsubscribeMedia = subscribeChatAttachments(selectedId, () => loadSelected().catch(() => {}))
    return () => { unsubscribeChat(); unsubscribeMedia() }
  }, [selectedId, loadSelected])

  const createGroup = async (event) => {
    event.preventDefault()
    if (!newGroup.name.trim()) return
    setBusy(true); setError('')
    try {
      const id = await createChatGroup({ hotelId: hotel.id, name: newGroup.name, retentionDays: newGroup.retention })
      setNewGroup({ name: '', retention: 30 }); setShowCreate(false)
      await loadGroups(); setSelectedId(id)
    } catch (e) { setError(e.message || 'Creazione gruppo non riuscita') }
    finally { setBusy(false) }
  }

  const clearFiles = () => {
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = async (event) => {
    event.preventDefault()
    const body = text.trim()
    const selectedFiles = Array.from(files || [])
    if ((!body && !selectedFiles.length) || !selectedId || busy) return
    setBusy(true); setError('')
    let message = null
    let uploaded = []
    try {
      message = await sendChatMessage(selectedId, currentUserId, body || `📎 ${selectedFiles.length} allegat${selectedFiles.length === 1 ? 'o' : 'i'}`)
      if (selectedFiles.length) {
        uploaded = await uploadGroupMediaFiles(selectedFiles, { groupId: selectedId, messageId: message.id })
        for (const attachment of uploaded) await registerGroupAttachment({ groupId: selectedId, messageId: message.id, attachment })
      }
      setText(''); clearFiles(); await loadSelected()
    } catch (e) {
      if (message?.id) await deleteChatMessage(message.id).catch(() => {})
      await cleanupRandMediaUploads(uploaded)
      setError(e.message || 'Invio non riuscito')
    } finally { setBusy(false) }
  }

  const openMembers = async () => {
    setShowMembers(true); setError('')
    try {
      const [mem, dir] = await Promise.all([fetchChatGroupMembers(selectedId), canManage ? fetchChatDirectory() : Promise.resolve([])])
      setMembers(mem); setDirectory(dir)
    } catch (e) { setError(e.message || 'Impossibile caricare i membri') }
  }

  const invite = async () => {
    if (!inviteId) return
    setBusy(true); setError('')
    try { await addChatGroupMember(selectedId, inviteId, 'member'); setInviteId(''); await openMembers() }
    catch (e) { setError(e.message || 'Invito non riuscito') }
    finally { setBusy(false) }
  }

  const changeRole = async (member, role) => {
    setBusy(true); setError('')
    try { await setChatGroupMemberRole(selectedId, member.auth_user_id, role); await openMembers() }
    catch (e) { setError(e.message || 'Modifica ruolo non riuscita') }
    finally { setBusy(false) }
  }

  const removeMember = async (member) => {
    if (!window.confirm(`Rimuovere ${member.display_name} dal gruppo?`)) return
    setBusy(true); setError('')
    try { await removeChatGroupMember(selectedId, member.auth_user_id); await openMembers() }
    catch (e) { setError(e.message || 'Rimozione non riuscita') }
    finally { setBusy(false) }
  }

  const changeRetention = async (days) => {
    if (!selected || !canManage) return
    setBusy(true); setError('')
    try { await updateChatGroup(selected.id, { retentionDays: Number(days) }); await loadGroups() }
    catch (e) { setError(e.message || 'Retention non aggiornata') }
    finally { setBusy(false) }
  }

  const togglePin = async (message) => {
    if (!canManage) return
    try { await setChatMessagePinned(message.id, !message.pinned_at) }
    catch (e) { setError(e.message || 'Impossibile aggiornare il messaggio') }
  }

  if (!user?.chat_enabled) {
    return <section className="rc-empty"><h2>RandChat non abilitata</h2><p>Un amministratore può abilitarla dal pannello Utenti.</p></section>
  }

  return (
    <section className="rc-shell" data-testid="randchat-groups">
      <aside className={`rc-groups ${selected ? 'rc-groups--has-selection' : ''}`}>
        <header className="rc-head"><div><h1>RandChat</h1><small>Gruppi operativi</small></div>{canCreate && <button className="rc-icon" onClick={() => setShowCreate((v) => !v)} aria-label="Nuovo gruppo">＋</button>}</header>
        {showCreate && <form className="rc-create" onSubmit={createGroup}>
          <input value={newGroup.name} maxLength={120} placeholder="Nome gruppo" onChange={(e) => setNewGroup((v) => ({ ...v, name: e.target.value }))} autoFocus />
          <label>Storico <select value={newGroup.retention} onChange={(e) => setNewGroup((v) => ({ ...v, retention: Number(e.target.value) }))}><option value={30}>30 giorni</option><option value={60}>60 giorni</option></select></label>
          <button disabled={busy || !newGroup.name.trim()}>Crea</button>
        </form>}
        <div className="rc-list">
          {groups.map((group) => <button key={group.id} className={`rc-group ${selectedId === group.id ? 'active' : ''}`} onClick={() => setSelectedId(group.id)}>
            <span className="rc-avatar">#</span><span><b>{group.name}</b><small>{hotelById(group.hotel_id)?.name || group.hotel_id} · {group.retention_days} gg</small></span>
          </button>)}
          {!groups.length && <p className="rc-muted">Nessun gruppo. {canCreate ? 'Creane uno per iniziare.' : 'Un admin di gruppo può invitarti.'}</p>}
        </div>
      </aside>

      <div className="rc-conversation">
        {!selected ? <div className="rc-empty"><h2>Seleziona un gruppo</h2><p>I gruppi sono aziendali, protetti da membership e permessi RandApp.</p></div> : <>
          <header className="rc-conversation__head">
            <button className="rc-back" onClick={() => setSelectedId(null)}>‹</button>
            <div><h2>{selected.name}</h2><small>{hotelById(selected.hotel_id)?.name || selected.hotel_id} · testo conservato {selected.retention_days} giorni</small></div>
            <div className="rc-head-actions"><button onClick={() => setShowProcedures(true)}>📘 Procedura</button><button onClick={() => setShowAI(true)}>✨ RandAI</button><button className="rc-members-btn" onClick={openMembers}>{members.length || ''} membri</button></div>
          </header>
          {error && <div className="rc-error" role="alert">{error}</div>}
          <div className="rc-messages">
            {messages.map((message) => {
              const sender = memberById.get(message.sender_user_id)
              const own = message.sender_user_id === currentUserId
              const procedureLink = procedureByMessage.get(message.id)
              const procedure = procedureLink?.procedure_snapshot
              const media = attachmentsByMessage.get(message.id) || []
              return <article key={message.id} className={`rc-message ${own ? 'own' : ''} ${message.pinned_at ? 'pinned' : ''}`}>
                <div className="rc-message__meta"><b>{own ? 'Tu' : sender?.display_name || 'Utente'}</b><time>{fmtTime(message.created_at)}</time>{message.pinned_at && <span>📌</span>}</div>
                <p>{message.body}</p>
                {procedure && <div className="rc-procedure-card"><b>📘 {procedure.title}</b><small>{procedure.category || 'Generale'} · v{procedureLink.procedure_version} · rischio {procedure.risk_level || 'normal'}</small><p>{procedure.summary}</p>{procedure.caution && <small>⚠️ {procedure.caution}</small>}</div>}
                {media.map((attachment) => <ChatAttachment key={attachment.id} attachment={attachment} />)}
                <div className="rc-message__actions">
                  <button className="rc-message__pin" onClick={() => setPromoteMessage(message)}>Crea segnalazione</button>
                  {!procedure && message.body && <button className="rc-message__pin" onClick={() => setDraftMessage(message)}>Bozza procedura</button>}
                  {canManage && <button className="rc-message__pin" onClick={() => togglePin(message)}>{message.pinned_at ? 'Sblocca' : 'Conserva'}</button>}
                </div>
              </article>
            })}
            {!messages.length && <p className="rc-muted rc-center">Ancora nessun messaggio.</p>}
          </div>
          <form className="rc-composer rc-composer--media" onSubmit={send}>
            <label className="rc-file-button" title="Allega foto, video, audio o documento">＋<input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
            <div className="rc-composer__body"><textarea value={text} maxLength={8000} rows={1} placeholder={`Scrivi in #${selected.name}`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !files.length) { e.preventDefault(); send(e) } }} />{files.length > 0 && <small>{files.length} allegat{files.length === 1 ? 'o' : 'i'} · max 20 MB ciascuno <button type="button" onClick={clearFiles}>Rimuovi</button></small>}</div>
            <button disabled={busy || (!text.trim() && !files.length)}>Invia</button>
          </form>
        </>}
      </div>

      {showMembers && selected && <div className="rc-modal-backdrop" onClick={() => setShowMembers(false)}><section className="rc-modal" onClick={(e) => e.stopPropagation()}>
        <header><div><h2>Membri · {selected.name}</h2><small>Gli invitati cross-hotel accedono solo a questo gruppo.</small></div><button className="rc-icon" onClick={() => setShowMembers(false)}>×</button></header>
        {canManage && <div className="rc-invite"><select value={inviteId} onChange={(e) => setInviteId(e.target.value)}><option value="">Aggiungi utente…</option>{inviteOptions.map((u) => <option key={u.auth_user_id} value={u.auth_user_id}>{u.display_name} · {displayHotels(u.hotel_ids)}</option>)}</select><button disabled={!inviteId || busy} onClick={invite}>Aggiungi</button></div>}
        <div className="rc-member-list">{members.map((member) => <div className="rc-member" key={member.auth_user_id}><span><b>{member.display_name}</b><small>{displayHotels(member.hotel_ids) || 'Nessuna struttura'} · {member.group_role}</small></span>{canManage && member.group_role !== 'owner' && <span className="rc-member__actions"><select value={member.group_role} onChange={(e) => changeRole(member, e.target.value)}><option value="member">Membro</option><option value="admin">Admin gruppo</option></select><button onClick={() => removeMember(member)}>Rimuovi</button></span>}</div>)}</div>
        {canManage && <label className="rc-retention">Cancellazione automatica testo <select value={selected.retention_days} onChange={(e) => changeRetention(e.target.value)}><option value={30}>30 giorni</option><option value={60}>60 giorni</option></select></label>}
      </section></div>}

      <ProcedurePicker open={showProcedures && Boolean(selected)} groupId={selectedId} onClose={() => setShowProcedures(false)} onShared={() => loadSelected().catch(() => {})} />
      <ProcedureDraftDialog open={Boolean(draftMessage && selected)} groupId={selectedId} hotelId={selected?.hotel_id} message={draftMessage} onClose={() => setDraftMessage(null)} />
      <RandChatAI open={showAI && Boolean(selected)} groupId={selectedId} groupName={selected?.name} onClose={() => setShowAI(false)} />
      <PromoteIssueDialog open={Boolean(promoteMessage)} onClose={() => setPromoteMessage(null)} user={user} hotel={hotel} text={promoteMessage?.body || ''} source={promoteMessage ? { type: 'group', id: selectedId, messageId: promoteMessage.id } : null} onPromoted={() => setPromoteMessage(null)} />
    </section>
  )
}
