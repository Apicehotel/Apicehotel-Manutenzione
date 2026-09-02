import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import TechnicianOperationsConsole from '../randai/control/TechnicianOperationsConsole.jsx'

const ALLOWED_ROLES = new Set(['manutentore', 'direzione', 'direttore centro congressi', 'reception', 'admin'])
const normalizeRole = (value) => String(value || '').trim().toLowerCase()

function mapIssue(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    room: row.camera,
    title: row.note,
    category: row.categoria,
    urgency: row.urgenza,
    status: row.stato,
    createdAt: row.creato_il,
  }
}

export default function TechnicianDispatchPortal() {
  const [state, setState] = useState('loading')
  const [memberships, setMemberships] = useState([])
  const [issues, setIssues] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setState('error'); setError('Supabase non configurato.'); return }
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) { setState('login'); return }
    const { data: membershipRows, error: membershipError } = await supabase.from('hotel_memberships')
      .select('hotel_id,role,active').eq('auth_user_id', authData.user.id).eq('active', true)
    if (membershipError) throw membershipError
    const operational = (membershipRows || []).filter((row) => ALLOWED_ROLES.has(normalizeRole(row.role)))
    if (!operational.length) { setMemberships([]); setState('denied'); return }
    const hotels = [...new Set(operational.map((row) => row.hotel_id))]
    const { data: issueRows, error: issueError } = await supabase.from('segnalazioni')
      .select('id,hotel_id,camera,note,categoria,urgenza,stato,creato_il,deleted_at')
      .in('hotel_id', hotels).is('deleted_at', null).neq('stato', 'done').order('creato_il', { ascending: false })
    if (issueError) throw issueError
    setMemberships(operational)
    setIssues((issueRows || []).map(mapIssue))
    setError('')
    setState('ready')
  }, [])

  useEffect(() => {
    load().catch((loadError) => { setError(loadError?.message || 'Impossibile caricare il Centro Tecnici.'); setState('error') })
  }, [load])

  const hotels = useMemo(() => [...new Set(memberships.map((row) => row.hotel_id))], [memberships])

  if (state !== 'ready') return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui' }}>
    <section style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 12 }}>
      <strong>RandApp · Centro Tecnici</strong>
      {state === 'loading' && <p>Caricamento…</p>}
      {state === 'login' && <p>Accedi prima a RandApp, poi riapri il Centro Tecnici.</p>}
      {state === 'denied' && <p>Il tuo ruolo non ha accesso operativo a richieste e tecnici esterni.</p>}
      {state === 'error' && <p>{error}</p>}
      <button onClick={() => window.location.assign('/')}>Torna a RandApp</button>
    </section>
  </main>

  return <main style={{ minHeight: '100dvh', padding: 'max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))', background: '#090d15', color: '#f7f9fc', fontFamily: 'system-ui' }}>
    <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 12 }}>
      <div><button onClick={() => window.location.assign('/')}>← RandApp</button></div>
      <TechnicianOperationsConsole accessHotels={hotels} hotelFilter="all" issues={issues} onRefresh={load} />
    </div>
  </main>
}
