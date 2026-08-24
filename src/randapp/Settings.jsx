import { useEffect, useMemo, useState } from 'react'
import { HOTELS, ROLES, ROLE_PERMISSIONS } from '../config.js'
import { supabase } from '../supabase.js'
import { supabaseUrl } from '../supabase.js'
import { fetchUsers, insertUser, updateUserRow, updateUserPin, setUserActive, permanentlyDeleteUser, getTechnicianLink } from '../users-data.js'
import { fetchAllSensors, updateSensorVisibility, syncSensorsFromEwelink } from '../sensors-admin-data.js'
import { Button, Card, Field, TextInput, Icon, IconButton, Badge, Spinner, EmptyState, Modal, ConfirmDialog, UiSizeControl, ThemeControl } from './ui.jsx'
import { logoFor } from './helpers.js'

const PERMISSION_LABELS = {
  manage_users: 'Gestione utenti', manage_all_hotels: 'Tutte le strutture', create: 'Crea segnalazioni', assign: 'Assegna lavori',
  complete: 'Completa lavori', read_all_departments: 'Tutti i reparti', planning_sale: 'Planning Sale', take_charge: 'Presa in carico', read_own_hotel: 'Lettura struttura',
}
const NAV_ITEMS = [
  ['home', 'Home'], ['issues', 'Segnalazioni'], ['interventions', 'Interventi'], ['planning_work', 'Planning lavori'],
  ['planning_sale', 'Planning Sale'], ['housekeeping', 'Housekeeping'], ['temperature', 'Temperature'], ['urgent', 'Avvisi urgenti'],
  ['technicians', 'Rubrica tecnici'], ['structure', 'Cambia struttura'], ['profile', 'Il mio profilo'], ['feedback', 'Feedback'],
]
const PLACEMENTS = [['bottom', 'Sotto'], ['side', 'Laterale'], ['off', 'Off']]
const NAV_KEY = 'role_navigation_v1'
const ALL_HOTEL_IDS = HOTELS.map((h) => h.id)

/* ---------------- Users ---------------- */
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [techLink, setTechLink] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [openGroups, setOpenGroups] = useState({})
  const empty = { name: '', role: 'Reception', email: '', phone: '', pin: '', hotels: [...ALL_HOTEL_IDS] }
  const [draft, setDraft] = useState(empty)

  const reload = () => fetchUsers(ALL_HOTEL_IDS).then((r) => setUsers(r.users || [])).catch(() => setUsers([])).finally(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? users.filter((u) => `${u.name} ${u.role} ${u.email || ''}`.toLowerCase().includes(q)) : users
  }, [users, search])
  const groups = useMemo(() => {
    const known = ROLES.map((role) => ({ role, list: filtered.filter((u) => u.role === role) })).filter((g) => g.list.length)
    const other = filtered.filter((u) => !ROLES.includes(u.role))
    return other.length ? [...known, { role: 'Altro', list: other }] : known
  }, [filtered])

  const save = async (target, changes) => {
    if (target.protected) return setMessage('Account protetto: non modificabile')
    try { await updateUserRow(target.auth_user_id || target.id, changes); await reload(); setMessage('Modifiche salvate') }
    catch (e) { setMessage(e?.message || 'Errore durante il salvataggio') }
  }
  const toggleHotel = (target, hotelId) => {
    const hotels = (target.hotels || []).includes(hotelId) ? target.hotels.filter((x) => x !== hotelId) : [...(target.hotels || []), hotelId]
    if (!hotels.length) return setMessage('Ogni utente deve mantenere almeno una struttura')
    save(target, { hotels })
  }
  const resetPin = async (target) => {
    const pin = window.prompt(`Nuovo PIN di 4 cifre per ${target.name}`) || ''
    if (!/^\d{4}$/.test(pin)) return setMessage('PIN non valido')
    try { await updateUserPin(target.auth_user_id || target.id, pin); setMessage(`PIN di ${target.name} aggiornato`) }
    catch (e) { setMessage(e?.message || 'Errore durante il cambio PIN') }
  }
  const toggleActive = async (target) => {
    try { await setUserActive(target.auth_user_id || target.id, !target.active); await reload() }
    catch (e) { setMessage(e?.message || 'Errore') }
  }
  const remove = async (target) => {
    try { await permanentlyDeleteUser(target.auth_user_id || target.id); await reload(); setMessage(`${target.name} eliminato`) }
    catch (e) { setMessage(e?.message || 'Errore durante l\'eliminazione') }
    finally { setConfirmDel(null) }
  }
  const showLink = async (target, regenerate) => {
    try { const token = await getTechnicianLink(target.auth_user_id || target.id, regenerate); setTechLink({ name: target.name, url: `${window.location.origin}/tecnico/${token}` }) }
    catch (e) { setMessage(e?.message || 'Errore link') }
  }
  const create = async (e) => {
    e.preventDefault()
    if (!draft.name.trim() || !/^\d{4}$/.test(draft.pin) || !draft.hotels.length) return setMessage('Inserisci nome, PIN di 4 cifre e almeno una struttura')
    try { await insertUser({ ...draft, name: draft.name.trim() }); await reload(); setDraft(empty); setCreating(false); setMessage(`${draft.name.trim()} aggiunto`) }
    catch (err) { setMessage(err?.message || 'Errore durante la creazione') }
  }

  if (loading) return <Spinner label="Carico gli utenti…" />
  return (
    <section data-testid="settings-users">
      <div className="rs-page-title">
        <div><h1>Utenti</h1><p>Gestisci utenti, ruoli e accessi alle strutture</p></div>
        <Button variant={creating ? 'ghost' : 'primary'} icon={creating ? 'close' : 'plus'} onClick={() => setCreating(!creating)} data-testid="toggle-create-user">{creating ? 'Annulla' : 'Nuovo'}</Button>
      </div>

      {creating && (
        <Card className="rs-card--pad" style={{ marginBottom: 14 }}>
          <form className="rs-form" onSubmit={create} data-testid="create-user-form">
            <Field label="Nome"><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome utente" /></Field>
            <Field label="Ruolo"><select className="rs-select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <div className="rs-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Email"><TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <Field label="Telefono"><TextInput value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
            </div>
            <Field label="PIN di 4 cifre"><TextInput icon="lock" inputMode="numeric" value={draft.pin} placeholder="••••" onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
            <fieldset className="rs-fieldset">
              <legend>Strutture abilitate</legend>
              <div className="rs-hotel-toggles">
                {HOTELS.map((h) => (
                  <button type="button" key={h.id} className={`rs-hotel-toggle ${draft.hotels.includes(h.id) ? 'on' : ''}`}
                    onClick={() => setDraft({ ...draft, hotels: draft.hotels.includes(h.id) ? draft.hotels.filter((x) => x !== h.id) : [...draft.hotels, h.id] })}>
                    {draft.hotels.includes(h.id) ? <Icon name="check" /> : null} {h.short}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button variant="primary" data-testid="save-new-user">Salva utente</Button>
          </form>
        </Card>
      )}

      <TextInput icon="search" value={search} placeholder="Cerca utente…" onChange={(e) => setSearch(e.target.value)} data-testid="user-search" />
      {message && <p className="rs-badge rs-badge--accent" style={{ display: 'inline-flex', margin: '12px 0' }} role="status">{message}</p>}

      <div style={{ marginTop: 14 }}>
        {groups.length === 0 ? <EmptyState icon="users" title="Nessun utente" /> : groups.map(({ role, list }) => (
          <div className="rs-role-group" key={role}>
            <button className={`rs-role-group__head ${openGroups[role] === false ? '' : 'open'}`} onClick={() => setOpenGroups((c) => ({ ...c, [role]: c[role] === false ? true : false }))}>
              <b>{role}</b><span>{list.length}</span><i><Icon name="chevronDown" /></i>
            </button>
            {openGroups[role] !== false && list.map((u) => (
              <Card key={u.auth_user_id || u.id} className="rs-usercard">
                <div className="rs-usercard__top">
                  <div><strong>{u.name}</strong><small>{[u.email, u.phone].filter(Boolean).join(' · ') || u.department || '—'}</small>{!u.active && <Badge tone="high" className="rs-badge">Disattivato</Badge>}</div>
                  {u.protected && <Badge tone="accent">Protetto</Badge>}
                </div>
                <select className="rs-select" value={u.role} disabled={u.protected} onChange={(e) => save(u, { role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                <div className="rs-hotel-toggles">
                  {HOTELS.map((h) => (
                    <button key={h.id} className={`rs-hotel-toggle ${(u.hotels || []).includes(h.id) ? 'on' : ''}`} disabled={u.protected} onClick={() => toggleHotel(u, h.id)}>
                      {(u.hotels || []).includes(h.id) ? <Icon name="check" /> : null} {h.short}
                    </button>
                  ))}
                </div>
                <div className="rs-usercard__actions">
                  <Button variant="ghost" size="sm" icon="lock" onClick={() => resetPin(u)} disabled={u.protected}>PIN</Button>
                  {u.role === 'Tecnico esterno' && <Button variant="ghost" size="sm" icon="link" onClick={() => showLink(u)}>Link</Button>}
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(u)} disabled={u.protected}>{u.active ? 'Disattiva' : 'Attiva'}</Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDel(u)} disabled={u.protected}>Elimina</Button>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>

      <Modal open={!!techLink} onClose={() => setTechLink(null)} title={techLink ? `Link di ${techLink.name}` : ''}>
        <p className="rs-field__hint">Chi apre questo link vede solo i lavori assegnati, senza PIN. Non condividerlo con altri.</p>
        <TextInput value={techLink?.url || ''} readOnly onFocus={(e) => e.target.select()} />
        <Button variant="ghost" icon="link" onClick={() => { navigator.clipboard?.writeText(techLink.url); setMessage('Link copiato') }}>Copia link</Button>
      </Modal>
      <ConfirmDialog open={!!confirmDel} title="Eliminare l'utente?" danger confirmLabel="Elimina definitivamente"
        message={confirmDel ? `${confirmDel.name} verrà eliminato definitivamente. L'azione non è reversibile.` : ''}
        onCancel={() => setConfirmDel(null)} onConfirm={() => remove(confirmDel)} />
    </section>
  )
}

/* ---------------- Sensors ---------------- */
function SensorsTab() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  useEffect(() => { fetchAllSensors().then((r) => setSensors(r.sensors || [])).catch(() => {}).finally(() => setLoading(false)) }, [])
  const toggle = async (sensor, hotelId) => {
    const flags = { hotelgio: !!sensor.mostra_hotelgio, chocohotel: !!sensor.mostra_chocohotel, brigantino: !!sensor.mostra_brigantino }
    flags[hotelId] = !flags[hotelId]
    setSensors((list) => list.map((s) => s.device_id === sensor.device_id ? { ...s, [`mostra_${hotelId}`]: flags[hotelId] } : s))
    await updateSensorVisibility(sensor.device_id, flags)
  }
  const sync = async () => { setSyncing(true); try { const r = await syncSensorsFromEwelink(supabaseUrl); setSensors(r.sensors || []) } finally { setSyncing(false) } }

  if (loading) return <Spinner label="Carico i sensori…" />
  return (
    <section data-testid="settings-sensors">
      <div className="rs-page-title">
        <div><h1>Sensori</h1><p>Visibilità dei sensori eWeLink per struttura</p></div>
        <Button variant="ghost" icon="refresh" onClick={sync} disabled={syncing} data-testid="sync-sensors">{syncing ? 'Sincronizzo…' : 'Sincronizza'}</Button>
      </div>
      {sensors.length === 0 ? <EmptyState icon="sensor" title="Nessun sensore" >Sincronizza da eWeLink per popolare la lista.</EmptyState> : sensors.map((s) => (
        <Card key={s.device_id} className="rs-sensor">
          <span className="rs-stat__icon blue"><Icon name="thermometer" /></span>
          <div className="rs-sensor__info"><strong>{s.nome || s.device_id}</strong><small>{s.temperatura != null ? `${s.temperatura}°C` : 'Temperatura non disponibile'}</small></div>
          <div className="rs-hotel-toggles">
            {HOTELS.map((h) => (
              <button key={h.id} className={`rs-hotel-toggle ${s[`mostra_${h.id}`] ? 'on' : ''}`} onClick={() => toggle(s, h.id)} data-testid={`sensor-${s.device_id}-${h.id}`}>
                {s[`mostra_${h.id}`] ? <Icon name="check" /> : null} {h.short}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </section>
  )
}

/* ---------------- Roles & Navigation ---------------- */
function NavigationTab() {
  const [role, setRole] = useState(ROLES[0])
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase) { setConfig({}); return }
    supabase.from('app_config').select('value').eq('key', NAV_KEY).maybeSingle().then(({ data }) => {
      try { setConfig(data?.value ? JSON.parse(data.value) : {}) } catch { setConfig({}) }
    }).catch(() => setConfig({}))
  }, [])

  const placement = (r, key) => config?.[r]?.[key] || 'off'
  const bottomCount = (r) => NAV_ITEMS.filter(([k]) => placement(r, k) === 'bottom').length
  const setPlacement = (key, value) => {
    setStatus('')
    if (value === 'bottom' && placement(role, key) !== 'bottom' && bottomCount(role) >= 5) { setStatus('Massimo 5 voci nella barra sotto.'); return }
    setConfig((c) => ({ ...c, [role]: { ...(c[role] || {}), [key]: value } }))
  }
  const saveConfig = async () => {
    if (!supabase) return
    setSaving(true); setStatus('')
    try { const { error } = await supabase.from('app_config').update({ value: JSON.stringify(config) }).eq('key', NAV_KEY); if (error) throw error; setStatus('Configurazione salvata') }
    catch (e) { setStatus(e?.message || 'Salvataggio non riuscito') }
    finally { setSaving(false) }
  }

  return (
    <section data-testid="settings-navigation">
      <div className="rs-page-title"><div><h1>Ruoli & Navigazione</h1><p>Permessi per ruolo e posizionamento delle funzioni</p></div></div>

      <h2 style={{ fontFamily: 'Sora', fontSize: '1rem', margin: '10px 4px' }}>Permessi per ruolo</h2>
      {ROLES.map((r) => (
        <Card key={r} className="rs-perm-card">
          <strong>{r}</strong>
          <div className="rs-perm-card__list">
            {(ROLE_PERMISSIONS[r] || []).map((p) => <Badge key={p} tone="accent">{PERMISSION_LABELS[p] || p}</Badge>)}
            {!(ROLE_PERMISSIONS[r] || []).length && <span className="rs-field__hint">Nessun permesso</span>}
          </div>
        </Card>
      ))}

      <h2 style={{ fontFamily: 'Sora', fontSize: '1rem', margin: '22px 4px 10px' }}>Navigazione</h2>
      <Card className="rs-card--pad">
        <Field label="Ruolo da configurare"><select className="rs-select" value={role} onChange={(e) => setRole(e.target.value)} data-testid="nav-role-select">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        {config === null ? <Spinner /> : (
          <>
            <p className="rs-field__hint" style={{ marginTop: 10 }}>{bottomCount(role)}/5 voci nella barra sotto</p>
            {NAV_ITEMS.map(([key, label]) => (
              <div className="rs-navrow" key={key}>
                <span>{label}</span>
                <div className="rs-navseg">
                  {PLACEMENTS.map(([val, l]) => (
                    <button key={val} className={placement(role, key) === val ? 'active' : ''} onClick={() => setPlacement(key, val)}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
            {status && <p className="rs-badge rs-badge--accent" style={{ display: 'inline-flex', marginTop: 12 }}>{status}</p>}
            <Button variant="primary" style={{ marginTop: 14 }} onClick={saveConfig} disabled={saving} data-testid="save-nav-config">{saving ? 'Salvo…' : 'Salva configurazione'}</Button>
          </>
        )}
      </Card>
    </section>
  )
}

/* ---------------- Appearance ---------------- */
function AppearanceTab() {
  return (
    <section data-testid="settings-appearance">
      <div className="rs-page-title"><div><h1>Aspetto</h1><p>Tema e dimensione interfaccia</p></div></div>
      <Card className="rs-card--pad" style={{ marginBottom: 12 }}>
        <div className="rs-uisize-block">
          <strong style={{ fontFamily: 'Sora' }}>Tema</strong>
          <small>Sistema segue le preferenze del dispositivo. Chiaro e Scuro forzano il tema.</small>
          <ThemeControl />
        </div>
      </Card>
      <Card className="rs-card--pad">
        <div className="rs-uisize-block">
          <strong style={{ fontFamily: 'Sora' }}>Dimensione interfaccia</strong>
          <small>Scegli Piccolo per vedere più contenuto, Grande per testo e pulsanti più leggibili. La scelta resta salvata su questo dispositivo.</small>
          <UiSizeControl />
        </div>
      </Card>
    </section>
  )
}

const TABS = [
  { id: 'users', icon: 'users', label: 'Utenti', render: () => <UsersTab /> },
  { id: 'sensors', icon: 'sensor', label: 'Sensori', render: () => <SensorsTab /> },
  { id: 'navigation', icon: 'sliders', label: 'Ruoli', render: () => <NavigationTab /> },
  { id: 'appearance', icon: 'sparkles', label: 'Aspetto', render: () => <AppearanceTab /> },
]

export default function Settings({ initialTab = 'users', onExit }) {
  const [tab, setTab] = useState(initialTab)
  const active = TABS.find((t) => t.id === tab)
  return (
    <div className="rs-root">
      <div className="rs-app">
        <header className="rs-settings-head">
          <div className="rs-settings-head__brand"><Icon name="gear" /><div><b>Impostazioni</b><small>RandApp Manutenzione</small></div></div>
          <Button variant="ghost" size="sm" icon="logout" onClick={onExit} data-testid="settings-exit">Esci</Button>
        </header>
        <main className="rs-content" data-testid="settings-content">{active?.render()}</main>
        <nav className="rs-settings-nav" data-testid="settings-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`rs-navbtn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} data-testid={`settings-tab-${t.id}`}>
              <Icon name={t.icon} /><small>{t.label}</small>
            </button>
          ))}
          <button className="rs-navbtn" onClick={onExit}><Icon name="home" /><small>RandApp</small></button>
        </nav>
      </div>
    </div>
  )
}
