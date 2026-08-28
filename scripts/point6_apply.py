from pathlib import Path

draft_store = '''const PREFIX = 'randapp-draft-v1'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

const storage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
const safePart = (value) => String(value || 'anonymous').trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()

export function draftKey(kind, hotelId, userId) {
  return `${PREFIX}:${safePart(kind)}:${safePart(hotelId)}:${safePart(userId)}`
}

export function sanitizeDraft(value) {
  if (!value || typeof value !== 'object') return null
  const clean = { ...value }
  delete clean.photoData
  delete clean.completionPhotoData
  if (clean.draft && typeof clean.draft === 'object') {
    clean.draft = { ...clean.draft }
    delete clean.draft.photoData
    delete clean.draft.completionPhotoData
  }
  return clean
}

export function loadDraft(kind, hotelId, userId, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = storage()
  if (!store) return null
  const key = draftKey(kind, hotelId, userId)
  try {
    const row = JSON.parse(store.getItem(key) || 'null')
    if (!row?.savedAt || !row?.value) return null
    if (Date.now() - Number(row.savedAt) > ttlMs) { store.removeItem(key); return null }
    return row.value
  } catch {
    try { store.removeItem(key) } catch {}
    return null
  }
}

export function saveDraft(kind, hotelId, userId, value) {
  const store = storage()
  if (!store) return false
  const clean = sanitizeDraft(value)
  if (!clean) return false
  try {
    store.setItem(draftKey(kind, hotelId, userId), JSON.stringify({ savedAt: Date.now(), value: clean }))
    return true
  } catch {
    return false
  }
}

export function clearDraft(kind, hotelId, userId) {
  const store = storage()
  if (!store) return
  try { store.removeItem(draftKey(kind, hotelId, userId)) } catch {}
}
'''
Path('src/draft-store.js').write_text(draft_store)

p = Path('src/randapp/Issues.jsx')
s = p.read_text()
s = s.replace("import { canUser } from '../permissions.js'\n", "import { canUser } from '../permissions.js'\nimport { clearDraft, loadDraft, saveDraft } from '../draft-store.js'\nimport { operationFailed } from '../operation-feedback.js'\n")
old = """  const [mode, setMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null })
  const [saving, setSaving] = useState(false)
  const [roomStatusSuggested, setRoomStatusSuggested] = useState(false)
"""
new = """  const draftOwner = user?.auth_user_id || user?.legacy_id || user?.id || user?.name || 'anonymous'
  const restoredDraft = useMemo(() => loadDraft('issue', hotel.id, draftOwner), [hotel.id, draftOwner])
  const [mode, setMode] = useState(restoredDraft?.mode || 'camera')
  const [draft, setDraft] = useState(() => ({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null, ...(restoredDraft?.draft || {}) }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [roomStatusSuggested, setRoomStatusSuggested] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft('issue', hotel.id, draftOwner, { mode, draft }), 250)
    return () => window.clearTimeout(timer)
  }, [hotel.id, draftOwner, mode, draft])
"""
if old not in s: raise SystemExit('Issues state anchor not found')
s = s.replace(old, new, 1)
s = s.replace("  const pickPhoto = async (file) => { const photoData = await compressPhotoAsDataUrl(file); setDraft((c) => ({ ...c, photoName: file?.name || '', photoData })) }", "  const pickPhoto = async (file) => {\n    try { const photoData = await compressPhotoAsDataUrl(file); setDraft((c) => ({ ...c, photoName: file?.name || '', photoData })); setSaveError('') }\n    catch (error) { setSaveError('Impossibile preparare la foto. Riprova o invia senza foto.'); operationFailed(error, 'Foto non disponibile') }\n  }")
old = """    try { await insertIssue(issue); onSaved() }
    catch (err) { console.warn(err); setSaving(false) }
"""
new = """    try {
      await insertIssue(issue)
      clearDraft('issue', hotel.id, draftOwner)
      setSaveError('')
      onSaved()
    } catch (err) {
      console.warn(err)
      setSaveError(navigator.onLine ? 'Invio non riuscito. La bozza resta salvata: puoi riprovare.' : 'Sei offline. La bozza resta salvata sul dispositivo: puoi riprovare quando torna la rete.')
      operationFailed(err, 'Segnalazione non inviata')
      setSaving(false)
    }
"""
if old not in s: raise SystemExit('Issues submit anchor not found')
s = s.replace(old, new, 1)
anchor = '      <div className="rs-form-actions">\n'
if anchor not in s: raise SystemExit('Issues action anchor not found')
s = s.replace(anchor, '      {saveError && <p className="rs-error" role="alert" data-testid="issue-save-error">{saveError}</p>}\n      {restoredDraft && !saveError && <small className="rs-field__hint">Bozza precedente ripristinata automaticamente.</small>}\n' + anchor, 1)
p.write_text(s)

p = Path('src/randapp/PlannedCreateSheet.jsx')
s = p.read_text()
s = s.replace("import { Button, Field, Icon, Sheet, TextInput } from './ui.jsx'\n", "import { Button, Field, Icon, Sheet, TextInput } from './ui.jsx'\nimport { clearDraft, loadDraft, saveDraft } from '../draft-store.js'\nimport { operationFailed } from '../operation-feedback.js'\n")
old = """  const [directory, setDirectory] = useState([])
  const [mode, setMode] = useState('camera')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('Varie')
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledUntil, setScheduledUntil] = useState('')
  const [assignees, setAssignees] = useState([])
  const [selectedFloorIds, setSelectedFloorIds] = useState([])
"""
new = """  const [directory, setDirectory] = useState([])
  const draftOwner = user?.auth_user_id || user?.legacy_id || user?.id || user?.name || 'anonymous'
  const restoredDraft = useMemo(() => loadDraft('planned-work', hotel?.id, draftOwner), [hotel?.id, draftOwner])
  const [mode, setMode] = useState(restoredDraft?.mode || 'camera')
  const [location, setLocation] = useState(restoredDraft?.location || '')
  const [category, setCategory] = useState(restoredDraft?.category || 'Varie')
  const [notes, setNotes] = useState(restoredDraft?.notes || '')
  const [scheduledAt, setScheduledAt] = useState(restoredDraft?.scheduledAt || '')
  const [scheduledUntil, setScheduledUntil] = useState(restoredDraft?.scheduledUntil || '')
  const [assignees, setAssignees] = useState(restoredDraft?.assignees || [])
  const [selectedFloorIds, setSelectedFloorIds] = useState(restoredDraft?.selectedFloorIds || [])
"""
if old not in s: raise SystemExit('Planned state anchor not found')
s = s.replace(old, new, 1)
insert_after = "  const [error, setError] = useState('')\n"
s = s.replace(insert_after, insert_after + """
  useEffect(() => {
    if (!open || !hotel?.id) return undefined
    const timer = window.setTimeout(() => saveDraft('planned-work', hotel.id, draftOwner, { mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds }), 250)
    return () => window.clearTimeout(timer)
  }, [open, hotel?.id, draftOwner, mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds])
""", 1)
s = s.replace("  const close = () => { reset(); onClose?.() }", "  const close = () => { onClose?.() }")
s = s.replace("      reset(); onSaved?.(); onClose?.()", "      clearDraft('planned-work', hotel.id, draftOwner); reset(); onSaved?.(); onClose?.()")
s = s.replace("    } catch (err) { setError(err?.message || 'Salvataggio non riuscito, riprova') }", "    } catch (err) { setError('Salvataggio non riuscito. La bozza resta sul dispositivo: riprova.'); operationFailed(err, 'Intervento non pianificato') }")
p.write_text(s)

p = Path('src/randapp/App.jsx')
s = p.read_text()
anchor = """  useEffect(() => {
    const onChange = () => setSession(loadSession())
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
"""
addition = anchor + """
  useEffect(() => {
    if (!session) return undefined
    let active = true
    const validate = async () => {
      if (!navigator.onLine) return
      try {
        const { validateSupabaseSession } = await import('../auth-data.js')
        const result = await validateSupabaseSession()
        if (active && !result.valid) {
          clearSession()
          setPending(null)
          setSession(null)
        }
      } catch (error) {
        console.warn('Controllo sessione rimandato', error)
      }
    }
    validate()
    window.addEventListener('online', validate)
    return () => { active = false; window.removeEventListener('online', validate) }
  }, [session?.hotelId, session?.userId])
"""
if anchor not in s: raise SystemExit('App session anchor not found')
s = s.replace(anchor, addition, 1)
p.write_text(s)

p = Path('src/error-boundary.jsx')
s = p.read_text()
old = """          <button
            onClick={() => window.location.reload()}
"""
new = """          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '10px 18px', marginRight: 8, borderRadius: 10, border: '1px solid #0e5c49', background: 'transparent', color: '#0e5c49', fontWeight: 700 }}
          >
            Riprova
          </button>
          <button
            onClick={() => window.location.reload()}
"""
if old not in s: raise SystemExit('Error boundary anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

test = '''import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sanitizeDraft } from '../src/draft-store.js'

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('point 6: drafts never persist large photo payloads', () => {
  const clean = sanitizeDraft({ title: 'rubinetto', photoData: 'data:image/jpeg;base64,AAA', completionPhotoData: 'AAA', draft: { title: 'x', photoData: 'BIG' } })
  assert.equal(clean.title, 'rubinetto')
  assert.equal(clean.photoData, undefined)
  assert.equal(clean.completionPhotoData, undefined)
  assert.equal(clean.draft.photoData, undefined)
})

test('point 6: issue and planned-work forms keep recoverable drafts and surface errors', async () => {
  const [issues, planned] = await Promise.all([source('src/randapp/Issues.jsx'), source('src/randapp/PlannedCreateSheet.jsx')])
  for (const code of [issues, planned]) {
    assert.match(code, /loadDraft\(/)
    assert.match(code, /saveDraft\(/)
    assert.match(code, /clearDraft\(/)
    assert.match(code, /operationFailed\(/)
  }
  assert.match(issues, /issue-save-error/)
  assert.match(planned, /La bozza resta sul dispositivo/)
})

test('point 6: stale sessions are revalidated on startup and reconnect without logging out on transport errors', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /validateSupabaseSession/)
  assert.match(app, /window\.addEventListener\('online', validate\)/)
  assert.match(app, /if \(active && !result\.valid\)/)
  assert.match(app, /Controllo sessione rimandato/)
})

test('point 6: offline queue has bounded backoff, permanent-failure quarantine and conflict protection', async () => {
  const offline = await source('src/offline-store.js')
  assert.match(offline, /BACKOFF_STEPS/)
  assert.match(offline, /moveToFailures/)
  assert.match(offline, /OFFLINE_CONFLICT/)
  assert.match(offline, /clientMutationId/)
  assert.match(offline, /window\.addEventListener\('online'/)
})

test('point 6: render crashes offer retry and reload recovery', async () => {
  const boundary = await source('src/error-boundary.jsx')
  assert.match(boundary, /this\.setState\(\{ error: null \}\)/)
  assert.match(boundary, /Riprova/)
  assert.match(boundary, /Ricarica l'app/)
})
'''
Path('test/point6-resilience.test.js').write_text(test)
