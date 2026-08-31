import { supabase } from './supabase.js'
import { assertValid } from './reliability/validation-engine.js'
import { validatePlanningWorkCreate, validatePlanningWorkStatus } from './reliability/domain-validation.js'
import { createMutationId, safeWrite, safeWriteConflict } from './reliability/safe-write-engine.js'

const mapDay = (row, job) => ({
  id: row.id,
  jobId: row.lavoro_id,
  hotelId: row.hotel_id || job?.hotel_id || null,
  date: row.data,
  status: row.stato || (row.fatto ? 'done' : 'pending'),
  done: Boolean(row.fatto),
  doneBy: row.fatto_da || null,
  doneAt: row.fatto_il ? new Date(row.fatto_il).getTime() : null,
  updatedAt: row.updated_at || null,
  note: row.note || '',
  description: job?.descrizione || '',
  createdBy: job?.creato_da || '',
  createdAt: job?.creato_il ? new Date(job.creato_il).getTime() : null,
})

const sameDates = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())

async function readPlanningJobSnapshot(jobId, hotelId) {
  const { data: job, error: jobError } = await supabase
    .from('planning_lavori')
    .select('*')
    .eq('id', jobId)
    .eq('hotel_id', hotelId)
    .maybeSingle()
  if (jobError) throw jobError
  if (!job) return null
  const { data: days, error: daysError } = await supabase
    .from('planning_lavori_giorni')
    .select('*')
    .eq('lavoro_id', jobId)
    .eq('hotel_id', hotelId)
    .order('data', { ascending: true })
  if (daysError) throw daysError
  return { job, days: days || [] }
}

async function readPlanningDay(id, hotelId) {
  const { data, error } = await supabase
    .from('planning_lavori_giorni')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotelId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

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
    .eq('hotel_id', hotelId)
    .in('lavoro_id', jobs.map((job) => job.id))
    .order('data', { ascending: true })
  if (daysError) throw daysError
  return (days || []).map((row) => mapDay(row, byId.get(row.lavoro_id)))
}

export async function createPlanningWork({ hotelId, description, dates, createdBy, mutationId = null }) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const normalizedDescription = String(description ?? '').trim()
  const normalizedDates = [...new Set((dates || []).map((date) => String(date).trim()))].sort()
  const stableMutationId = mutationId || createMutationId('RND-PLAN')

  const result = await safeWrite({
    operation: 'planning_work.create',
    preflight: () => assertValid(
      validatePlanningWorkCreate({ hotelId, description: normalizedDescription, dates: normalizedDates }),
      'Planning lavoro non valido',
    ),
    write: async () => {
      const { data, error } = await supabase.rpc('create_planning_work_safe', {
        p_hotel_id: hotelId,
        p_description: normalizedDescription,
        p_dates: normalizedDates,
        p_created_by_name: createdBy || null,
        p_mutation_id: stableMutationId,
      })
      if (error) throw error
      return data
    },
    readBack: async ({ writeResult }) => {
      const jobId = writeResult?.id
      return jobId ? readPlanningJobSnapshot(jobId, hotelId) : null
    },
    verify: (snapshot) => ({
      ok: snapshot.job.hotel_id === hotelId
        && snapshot.job.descrizione === normalizedDescription
        && snapshot.job.mutation_id === stableMutationId
        && sameDates(snapshot.days.map((day) => day.data), normalizedDates)
        && snapshot.days.every((day) => day.hotel_id === hotelId && day.lavoro_id === snapshot.job.id),
    }),
  })

  return result.value.job
}

export async function setPlanningWorkStatus(id, status, userName, { hotelId, expectedUpdatedAt = null } = {}) {
  if (!supabase) throw new Error('Supabase non disponibile')
  if (!id) throw new TypeError('id è obbligatorio')
  if (!hotelId) throw new TypeError('hotelId è obbligatorio')
  assertValid(validatePlanningWorkStatus(status), 'Stato planning lavoro non valido')
  const now = new Date().toISOString()
  const patch = status === 'done'
    ? { stato: 'done', fatto: true, fatto_da: userName || null, fatto_il: now, updated_at: now }
    : status === 'da_finire'
      ? { stato: 'da_finire', fatto: false, fatto_da: null, fatto_il: null, updated_at: now }
      : { stato: 'pending', fatto: false, fatto_da: null, fatto_il: null, updated_at: now }

  const result = await safeWrite({
    operation: 'planning_work_day.status',
    write: async () => {
      let query = supabase
        .from('planning_lavori_giorni')
        .update(patch)
        .eq('id', id)
        .eq('hotel_id', hotelId)
      if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
      const { data, error } = await query.select('*').maybeSingle()
      if (error) throw error
      if (!data && expectedUpdatedAt) throw safeWriteConflict('Il lavoro è stato modificato da un altro dispositivo', { id, hotelId })
      return data
    },
    readBack: () => readPlanningDay(id, hotelId),
    verify: (row) => ({ ok: row.stato === status && Boolean(row.fatto) === (status === 'done') }),
  })
  return mapDay(result.value, null)
}

export async function deletePlanningWorkDay(id, { hotelId, expectedUpdatedAt = null } = {}) {
  if (!supabase) throw new Error('Supabase non disponibile')
  if (!id) throw new TypeError('id è obbligatorio')
  if (!hotelId) throw new TypeError('hotelId è obbligatorio')

  const result = await safeWrite({
    operation: 'planning_work_day.delete',
    expectation: 'absent',
    write: async () => {
      let query = supabase
        .from('planning_lavori_giorni')
        .delete()
        .eq('id', id)
        .eq('hotel_id', hotelId)
      if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
      const { data, error } = await query.select('id').maybeSingle()
      if (error) throw error
      if (!data && expectedUpdatedAt) {
        const current = await readPlanningDay(id, hotelId)
        if (current) throw safeWriteConflict('Il lavoro è stato modificato da un altro dispositivo', { id, hotelId })
      }
      return data
    },
    readBack: () => readPlanningDay(id, hotelId),
  })
  return result.ok
}

export function subscribePlanningWork(hotelId, onChange) {
  if (!supabase) return () => {}
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
      filter: `hotel_id=eq.${hotelId}`,
    }, onChange)
  channel.subscribe()
  return () => {
    supabase.removeChannel(channel).catch(() => undefined)
  }
}
