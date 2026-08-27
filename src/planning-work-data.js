import { supabase } from './supabase.js'

const mapDay = (row, job) => ({
  id: row.id,
  jobId: row.lavoro_id,
  date: row.data,
  status: row.stato || (row.fatto ? 'done' : 'pending'),
  done: Boolean(row.fatto),
  doneBy: row.fatto_da || null,
  doneAt: row.fatto_il ? new Date(row.fatto_il).getTime() : null,
  note: row.note || '',
  description: job?.descrizione || '',
  createdBy: job?.creato_da || '',
  createdAt: job?.creato_il ? new Date(job.creato_il).getTime() : null,
})

export async function fetchPlanningWork(hotelId) {
  if (!supabase) return []
  const { data: jobs, error: jobsError } = await supabase
    .from('planning_lavori')
    .select('*')
    .eq('hotel_id', hotelId)
  if (jobsError) throw jobsError
  if (!jobs?.length) return []
  const byId = new Map(jobs.map((job) => [job.id, job]))
  const { data: days, error: daysError } = await supabase
    .from('planning_lavori_giorni')
    .select('*')
    .in('lavoro_id', jobs.map((job) => job.id))
    .order('data', { ascending: true })
  if (daysError) throw daysError
  return (days || []).map((row) => mapDay(row, byId.get(row.lavoro_id)))
}

export async function createPlanningWork({ hotelId, description, dates, createdBy, createdByUserId = null }) {
  const { data: job, error: jobError } = await supabase
    .from('planning_lavori')
    .insert({ hotel_id: hotelId, descrizione: description, creato_da: createdBy || null, created_by_user_id: createdByUserId || null })
    .select()
    .single()
  if (jobError) throw jobError
  const rows = dates.map((date) => ({ lavoro_id: job.id, data: date, fatto: false, stato: 'pending' }))
  const { error: daysError } = await supabase.from('planning_lavori_giorni').insert(rows)
  if (daysError) throw daysError
  return job
}

export async function setPlanningWorkStatus(id, status, userName) {
  const now = new Date().toISOString()
  const patch = status === 'done'
    ? { stato: 'done', fatto: true, fatto_da: userName || null, fatto_il: now }
    : status === 'da_finire'
      ? { stato: 'da_finire', fatto: false, fatto_da: null, fatto_il: null }
      : { stato: 'pending', fatto: false, fatto_da: null, fatto_il: null }
  const { error } = await supabase.from('planning_lavori_giorni').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePlanningWorkDay(id) {
  const { error } = await supabase.from('planning_lavori_giorni').delete().eq('id', id)
  if (error) throw error
}

export function subscribePlanningWork(hotelId, onChange) {
  if (!supabase) return () => {}

  // React StrictMode può montare/smontare/rimontare rapidamente il componente.
  // Supabase non permette di aggiungere nuovi postgres_changes a un canale già
  // sottoscritto con lo stesso topic, quindi ogni sottoscrizione usa un topic unico.
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const channel = supabase
    .channel(`planning-lavori-${hotelId}-${suffix}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'planning_lavori',
      filter: `hotel_id=eq.${hotelId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'planning_lavori_giorni',
    }, onChange)

  channel.subscribe()

  return () => {
    supabase.removeChannel(channel).catch(() => undefined)
  }
}
