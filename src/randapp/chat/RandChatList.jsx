export default function RandChatList({
  mode,
  onModeChange,
  groups,
  threads,
  activeId,
  onOpen,
  canCreateGroup,
  showNewGroup,
  onToggleNewGroup,
  newGroupName,
  onNewGroupName,
  onCreateGroup,
  cryptoReady,
  directory,
  currentUserId,
  newRecipient,
  onNewRecipient,
  onStartDm,
  busy,
  error,
}) {
  const items = mode === 'groups' ? groups : threads

  return <aside className="randchat-list" aria-label="Conversazioni RandChat">
    <header className="randchat-list__head">
      <div>
        <h1>RandChat</h1>
        <small>Messaggistica interna</small>
      </div>
      {mode === 'groups' && canCreateGroup && (
        <button className="randchat-iconbtn" onClick={onToggleNewGroup} aria-label="Nuovo gruppo">＋</button>
      )}
    </header>

    <nav className="randchat-tabs" aria-label="Tipo conversazione">
      <button className={mode === 'groups' ? 'active' : ''} onClick={() => onModeChange('groups')}>Gruppi</button>
      <button className={mode === 'dm' ? 'active' : ''} onClick={() => onModeChange('dm')}>🔒 Diretti</button>
    </nav>

    {mode === 'groups' && showNewGroup && (
      <div className="randchat-create">
        <input value={newGroupName} onChange={(e) => onNewGroupName(e.target.value)} placeholder="Nome gruppo" autoFocus />
        <button onClick={onCreateGroup} disabled={busy || !newGroupName.trim()}>Crea</button>
      </div>
    )}

    {mode === 'dm' && (
      <div className="randchat-create">
        <select value={newRecipient} onChange={(e) => onNewRecipient(e.target.value)} disabled={!cryptoReady || busy}>
          <option value="">Nuovo diretto…</option>
          {directory.filter((x) => x.auth_user_id !== currentUserId).map((x) => (
            <option key={x.auth_user_id} value={x.auth_user_id}>{x.display_name}</option>
          ))}
        </select>
        <button onClick={onStartDm} disabled={busy || !newRecipient}>Apri</button>
      </div>
    )}

    {error && <div className="randchat-banner randchat-banner--error">{error}</div>}

    <div className="randchat-list__scroll">
      {items.map((item) => {
        const title = mode === 'groups' ? item.name : item.other_display_name
        const subtitle = mode === 'groups'
          ? `${item.hotel_label || item.hotel_id} · ${item.retention_days} gg`
          : `🔒 E2EE · ${item.retention_days} gg`
        return <button key={item.id} className={`randchat-row ${activeId === item.id ? 'active' : ''}`} onClick={() => onOpen(item.id)}>
          <span className="randchat-avatar">{mode === 'groups' ? '#' : '🔒'}</span>
          <span className="randchat-row__copy"><b>{title}</b><small>{subtitle}</small></span>
          <span className="randchat-row__chevron">›</span>
        </button>
      })}
      {!items.length && <div className="randchat-empty">Nessuna conversazione.</div>}
    </div>
  </aside>
}
