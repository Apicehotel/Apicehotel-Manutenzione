import { useCallback, useEffect, useMemo, useState } from 'react'
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
import ProcedureDraftDialog from './ProcedureDraftDialog.jsx'
import ProcedurePicker from './ProcedurePicker.jsx'
import PromoteIssueDialog from './PromoteIssueDialog.jsx'
import RandChatAI from './RandChatAI.jsx'
import RandChatList from './RandChatList.jsx'
import RandChatThread from './RandChatThread.jsx'
import './randchat.css'

const roleRank = { owner: 0, admin: 1, member: 2 }

export default function RandChat({ user, hotel }) {
  const currentUserId = user?.auth_user_id || user?.id
  const [mode, setMode] = useState('groups')
  const [groups, setGroups] = useState([])
  const [threads, setThreads] = useState([])
  const [groupDirectory, setGroupDirectory] = useState([])
  const [dmDirectory, setDmDirectory] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [devices, setDevices] = useState([])
  const [attachments, setAttachments] = useState([])
  const [procedureLinks, setProcedureLinks] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cryptoReady, setCryptoReady] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupRetention, setNewGroupRetention] = useState(30)
  const [newRecipient, setNewRecipient] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [inviteId, setInviteId] = useState('')
  const [showProcedures, setShowProcedures] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [promoteMessage, setPromoteMessage] = useState(null)
  const [draftMessage, setDraftMessage] = useState(null)

  const activeGroup = useMemo(
    () => mode === 'groups' ? groups.find((item) => item.id === activeId) || null : null,
    [mode, groups, activeId],
  )
  const activeThread = useMemo(
    () => mode === 'dm' ? threads.find((item) => item.id === activeId) || null : null,
    [mode, threads, activeId],
  )
  const active = activeGroup || activeThread

  const me = useMemo(
    () => members.find((member) => member.auth_user_id === currentUserId) || null,
    [members, currentUserId],
  )
  const canManageGroup = Boolean(me && (me.group_role === 'owner' || me.group_role === 'admin'))
  const canCreateGroup = Boolean(user?.chat_can_create_groups || user?.can_admin)

  const memberById = useMemo(() => new Map(members.map((member) => [member.auth_user_id, member])), [members])
  const procedureByMessage = useMemo(
    () => new Map(procedureLinks.map((item) => [item.group_message_id, item])),
    [procedureLinks],
  )
  const attachmentsByMessage = useMemo(() => {
    const map = new Map()
    attachments.forEach((item) => map.set(item.group_message_id, [...(map.get(item.group_message_id) || []), item]))
    return map
  }, [attachments])

  const groupsForList = useMemo(
    () => groups.map((group) => ({ ...group, hotel_label: hotelById(group.hotel_id)?.name || group.hotel_id })),
    [groups],
  )

  const loadLists = useCallback(async () => {
    if (!user?.chat_enabled) return
    const [groupRows, threadRows] = await Promise.all([
      fetchChatGroups(),
      fetchDmThreads().catch(() => []),
    ])
    setGroups(groupRows)
    setThreads(threadRows)
  }, [user?.chat_enabled])

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setMessages([])
      setMembers([])
      setDevices([])
      setAttachments([])
      setProcedureLinks([])
      return
    }

    if (mode === 'groups') {
      const [messageRows, memberRows, mediaRows, procedureRows] = await Promise.all([
        fetchChatMessages(activeId),
        fetchChatGroupMembers(activeId),
        fetchGroupAttachments(activeId),
        fetchGroupProcedureLinks(activeId),
      ])
      setMessages(messageRows)
      setMembers(memberRows.sort((a, b) =>
        (roleRank[a.group_role] ?? 9) - (roleRank[b.group_role] ?? 9)
        || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'it'),
      ))
      setAttachments(mediaRows)
      setProcedureLinks(procedureRows)
      setDevices([])
      return
    }

    const [{ messages: messageRows }, deviceRows] = await Promise.all([
      fetchDmMessages(activeId, currentUserId),
      fetchDmDevices(activeId),
    ])
    setMessages(messageRows)
    setDevices(deviceRows)
    setMembers([])
    setAttachments([])
    setProcedureLinks([])
  }, [activeId, mode, currentUserId])

  useEffect(() => {
    if (!user?.chat_enabled) return
    let alive = true
    ;(async () => {
      try {
        await ensureRegisteredDmDevice(currentUserId)
        const [groupRows, threadRows, groupDirRows, dmDirRows] = await Promise.all([
          fetchChatGroups(),
          fetchDmThreads(),
          fetchChatDirectory(),
          fetchDmDirectory(),
        ])
        if (!alive) return
        setGroups(groupRows)
        setThreads(threadRows)
        setGroupDirectory(groupDirRows)
        setDmDirectory(dmDirRows)
        setCryptoReady(true)
      } catch (reason) {
        if (alive) setError(reason?.message || 'RandChat non disponibile')
      }
    })()
    return () => { alive = false }
  }, [currentUserId, user?.chat_enabled])

  useEffect(() => {
    loadThread().catch((reason) => setError(reason?.message || 'Conversazione non disponibile'))
  }, [loadThread])

  useEffect(() => {
    if (!activeId) return undefined

    if (mode === 'groups') {
      const unsubscribeChat = subscribeChatGroup(activeId, {
        onMessage: () => loadThread().catch(() => {}),
        onMessageChange: () => loadThread().catch(() => {}),
        onMembershipChange: () => loadThread().catch(() => {}),
      })
      const unsubscribeMedia = subscribeChatAttachments(activeId, () => loadThread().catch(() => {}))
      return () => {
        unsubscribeChat()
        unsubscribeMedia()
      }
    }

    return subscribeDmThread(activeId, () => {
      loadThread().catch(() => {})
      loadLists().catch(() => {})
    })
  }, [activeId, mode, loadThread, loadLists])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setActiveId(null)
    setMessages([])
    setError('')
    setShowMembers(false)
    setShowProcedures(false)
    setShowAI(false)
  }

  const openConversation = (id) => {
    setError('')
    setActiveId(id)
  }

  const closeConversation = () => {
    setActiveId(null)
    setMessages([])
    setError('')
    setShowMembers(false)
    setShowProcedures(false)
    setShowAI(false)
  }

  const createGroupNow = async () => {
    const name = newGroupName.trim()
    if (!name || busy || !canCreateGroup) return
    setBusy(true)
    setError('')
    try {
      const id = await createChatGroup({ hotelId: hotel.id, name, retentionDays: newGroupRetention })
      setNewGroupName('')
      setNewGroupRetention(30)
      setShowNewGroup(false)
      await loadLists()
      setMode('groups')
      setActiveId(id)
    } catch (reason) {
      setError(reason?.message || 'Creazione gruppo non riuscita')
    } finally {
      setBusy(false)
    }
  }

  const startDm = async () => {
    if (!newRecipient || busy) return
    setBusy(true)
    setError('')
    try {
      const id = await openDmThread(newRecipient)
      setNewRecipient('')
      await loadLists()
      setMode('dm')
      setActiveId(id)
    } catch (reason) {
      setError(reason?.message || 'Impossibile aprire il diretto')
    } finally {
      setBusy(false)
    }
  }

  const send = async (body, selectedFiles) => {
    if (!activeId || busy) return false
    setBusy(true)
    setError('')
    try {
      if (mode === 'groups') {
        let message = null
        let uploaded = []
        try {
          message = await sendChatMessage(
            activeId,
            currentUserId,
            body || `📎 ${selectedFiles.length} allegat${selectedFiles.length === 1 ? 'o' : 'i'}`,
          )
          if (selectedFiles.length) {
            uploaded = await uploadGroupMediaFiles(selectedFiles, { groupId: activeId, messageId: message.id })
            for (const attachment of uploaded) {
              await registerGroupAttachment({ groupId: activeId, messageId: message.id, attachment })
            }
          }
        } catch (reason) {
          if (message?.id) await deleteChatMessage(message.id).catch(() => {})
          await cleanupRandMediaUploads(uploaded)
          throw reason
        }
      } else {
        await sendDmMessage({ threadId: activeId, userId: currentUserId, body, files: selectedFiles })
      }

      await Promise.all([loadThread(), loadLists()])
      return true
    } catch (reason) {
      setError(reason?.message || 'Invio non riuscito')
      return false
    } finally {
      setBusy(false)
    }
  }


  const togglePin = async (message) => {
    if (!canManageGroup) return
    try {
      await setChatMessagePinned(message.id, !message.pinned_at)
      await loadThread()
    } catch (reason) {
      setError(reason?.message || 'Impossibile aggiornare il messaggio')
    }
  }

  const inviteMember = async () => {
    if (!inviteId || !activeGroup || !canManageGroup || busy) return
    setBusy(true)
    setError('')
    try {
      await addChatGroupMember(activeGroup.id, inviteId, 'member')
      setInviteId('')
      await loadThread()
    } catch (reason) {
      setError(reason?.message || 'Invito non riuscito')
    } finally {
      setBusy(false)
    }
  }

  const changeMemberRole = async (member, role) => {
    if (!activeGroup || !canManageGroup || busy) return
    setBusy(true)
    try {
      await setChatGroupMemberRole(activeGroup.id, member.auth_user_id, role)
      await loadThread()
    } catch (reason) {
      setError(reason?.message || 'Ruolo non aggiornato')
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (member) => {
    if (!activeGroup || !canManageGroup || member.group_role === 'owner' || busy) return
    if (!window.confirm(`Rimuovere ${member.display_name} dal gruppo?`)) return
    setBusy(true)
    try {
      await removeChatGroupMember(activeGroup.id, member.auth_user_id)
      await loadThread()
    } catch (reason) {
      setError(reason?.message || 'Membro non rimosso')
    } finally {
      setBusy(false)
    }
  }

  if (!user?.chat_enabled) {
    return <section className="randchat-empty"><h2>RandChat non abilitata</h2><p>Un amministratore può abilitarla dal pannello Utenti.</p></section>
  }

  const dmRecipientHasDevice = mode !== 'dm'
    || !activeThread
    || devices.some((device) => device.auth_user_id === activeThread.other_user_id)

  const inviteOptions = groupDirectory.filter(
    (candidate) => !members.some((member) => member.auth_user_id === candidate.auth_user_id),
  )

  return <section className={`randchat ${active ? 'randchat--thread-open' : ''}`} data-testid="randchat">
    <RandChatList
      mode={mode}
      onModeChange={switchMode}
      groups={groupsForList}
      threads={threads}
      activeId={activeId}
      onOpen={openConversation}
      canCreateGroup={canCreateGroup}
      showNewGroup={showNewGroup}
      onToggleNewGroup={() => setShowNewGroup((value) => !value)}
      newGroupName={newGroupName}
      onNewGroupName={setNewGroupName}
      newGroupRetention={newGroupRetention}
      onNewGroupRetention={setNewGroupRetention}
      onCreateGroup={createGroupNow}
      cryptoReady={cryptoReady}
      directory={dmDirectory}
      currentUserId={currentUserId}
      newRecipient={newRecipient}
      onNewRecipient={setNewRecipient}
      onStartDm={startDm}
      busy={busy}
      error={!active ? error : ''}
    />

    <main className="randchat-stage">
      {!active ? <div className="randchat-stage__empty">
        <div className="randchat-stage__mark">💬</div>
        <h2>Apri una conversazione</h2>
        <p>Scegli un gruppo o un diretto dalla lista.</p>
      </div> : <RandChatThread
        mode={mode}
        threadId={activeId}
        activeGroup={activeGroup}
        activeThread={activeThread}
        hotelLabel={mode === 'groups' ? hotelById(activeGroup?.hotel_id)?.name || activeGroup?.hotel_id : ''}
        members={members}
        messages={messages}
        currentUserId={currentUserId}
        memberById={memberById}
        procedureByMessage={procedureByMessage}
        attachmentsByMessage={attachmentsByMessage}
        busy={busy}
        error={error}
        dmRecipientHasDevice={dmRecipientHasDevice}
        canManageGroup={canManageGroup}
        onBack={closeConversation}
        onSend={send}
        onOpenProcedures={() => setShowProcedures(true)}
        onOpenAI={() => setShowAI(true)}
        onOpenMembers={() => setShowMembers(true)}
        onPromote={setPromoteMessage}
        onDraftProcedure={setDraftMessage}
        onTogglePin={togglePin}
      />}
    </main>

    {showMembers && mode === 'groups' && activeGroup && <div className="randchat-modal-backdrop" onClick={() => setShowMembers(false)}>
      <section className="randchat-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><h3>Membri · {activeGroup.name}</h3><small>{members.length} membri</small></div>
          <button onClick={() => setShowMembers(false)} aria-label="Chiudi">×</button>
        </header>
        {canManageGroup && <div className="randchat-member-add">
          <select value={inviteId} onChange={(event) => setInviteId(event.target.value)}>
            <option value="">Aggiungi utente…</option>
            {inviteOptions.map((candidate) => <option key={candidate.auth_user_id} value={candidate.auth_user_id}>{candidate.display_name}</option>)}
          </select>
          <button onClick={inviteMember} disabled={!inviteId || busy}>Aggiungi</button>
        </div>}
        <div className="randchat-members">
          {members.map((member) => <div className="randchat-member" key={member.auth_user_id}>
            <span><b>{member.display_name}</b><small>{member.group_role}</small></span>
            {canManageGroup && member.group_role !== 'owner' && <span className="randchat-member__actions">
              <select value={member.group_role} onChange={(event) => changeMemberRole(member, event.target.value)} disabled={busy}>
                <option value="member">Membro</option>
                <option value="admin">Admin gruppo</option>
              </select>
              <button onClick={() => removeMember(member)} disabled={busy}>Rimuovi</button>
            </span>}
          </div>)}
        </div>
      </section>
    </div>}

    <ProcedurePicker
      open={showProcedures && mode === 'groups' && Boolean(activeGroup)}
      groupId={activeId}
      onClose={() => setShowProcedures(false)}
      onShared={() => loadThread().catch(() => {})}
    />
    <ProcedureDraftDialog
      open={Boolean(draftMessage && activeGroup)}
      groupId={activeId}
      hotelId={activeGroup?.hotel_id}
      message={draftMessage}
      onClose={() => setDraftMessage(null)}
    />
    <RandChatAI
      open={showAI && mode === 'groups' && Boolean(activeGroup)}
      groupId={activeId}
      groupName={activeGroup?.name}
      onClose={() => setShowAI(false)}
    />
    <PromoteIssueDialog
      open={Boolean(promoteMessage)}
      onClose={() => setPromoteMessage(null)}
      user={user}
      hotel={hotel}
      text={promoteMessage?.body || ''}
      source={promoteMessage ? { type: mode === 'groups' ? 'group' : 'dm', id: activeId, messageId: promoteMessage.id } : null}
      onPromoted={() => setPromoteMessage(null)}
    />
  </section>
}
