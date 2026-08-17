import { supabase } from './supabase.js'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase non configurato')
  }
}

function normalizeSource(value) {
  const source = String(value || 'App')
    .trim()
    .toLowerCase()

  if (source.includes('whatsapp')) return 'whatsapp'
  if (
    source.includes('system') ||
    source.includes('sistema')
  ) return 'system'

  return 'app'
}

function dbToIssue(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    urgency: row.priority || 'media',
    room: row.location || '',
    title: row.description || '',
    status: row.status || 'todo',
    date: row.created_at
      ? new Date(row.created_at).toLocaleString(
          'it-IT',
          {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }
        )
      : '',
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : null,
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || '',
    department: row.department || '',
    category: row.category || '',
    origin: row.source || 'app',
    roomStatus: row.room_status || null,
    pieceName: row.waiting_part_name || null,
    completionNote:
      row.completion_note || null,
    completedAt: row.completed_at
      ? new Date(row.completed_at).getTime()
      : null,
    completedBy:
      row.completed_by_name || null,
    pieceDecision:
      row.piece_decision || null,
    pieceDecisionBy:
      row.piece_decision_by || null,
    pieceReplaced:
      row.piece_replaced || null,
    pieceReplacedBy:
      row.piece_replaced_by || null,
    technicianRequestedBy:
      row.technician_requested_by || null,
    technicianRequestedAt:
      row.technician_requested_at
        ? new Date(
            row.technician_requested_at
          ).getTime()
        : null,
    externalTechnicianName:
      row.external_technician_name || null,
    externalTechnicianPhone:
      row.external_technician_phone || null,
    assignedTo: row.assigned_to || null,
  }
}

function issueToDb(issue) {
  const row = {
    hotel_id: issue.hotelId,
    location: issue.room,
    category: issue.category || null,
    priority: issue.urgency || 'media',
    status: issue.status || 'todo',
    description: issue.title || null,
    source: normalizeSource(issue.origin),
    department: issue.department || null,
    room_status: issue.roomStatus || null,
    waiting_part_name: issue.pieceName || null,
    completion_note:
      issue.completionNote || null,
    created_by_name:
      issue.createdByName || null,
    completed_by_name:
      issue.completedBy || null,
    piece_decision:
      issue.pieceDecision || null,
    piece_decision_by:
      issue.pieceDecisionBy || null,
    piece_replaced:
      issue.pieceReplaced || null,
    piece_replaced_by:
      issue.pieceReplacedBy || null,
    technician_requested_by:
      issue.technicianRequestedBy || null,
    external_technician_name:
      issue.externalTechnicianName || null,
    external_technician_phone:
      issue.externalTechnicianPhone || null,
    assigned_to:
      issue.assignedTo || null,
  }

  if (issue.createdBy) {
    row.created_by = issue.createdBy
  }

  if (issue.completedAt) {
    row.completed_at =
      new Date(
        issue.completedAt
      ).toISOString()
  }

  if (issue.technicianRequestedAt) {
    row.technician_requested_at =
      new Date(
        issue.technicianRequestedAt
      ).toISOString()
  }

  return row
}

export async function fetchIssues(hotelId) {
  requireSupabase()

  let query = supabase
    .from('maintenance_issues')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (hotelId) {
    query = query.eq(
      'hotel_id',
      hotelId
    )
  }

  const { data, error } =
    await query

  if (error) {
    console.error(
      'fetchIssues error',
      error
    )

    throw new Error(
      'Impossibile caricare le segnalazioni'
    )
  }

  return (data || []).map(dbToIssue)
}

export async function createIssue(issue) {
  requireSupabase()

  const row = issueToDb(issue)

  const { data, error } =
    await supabase
      .from('maintenance_issues')
      .insert(row)
      .select('*')
      .single()

  if (error) {
    console.error(
      'createIssue error',
      error
    )

    throw new Error(
      'Impossibile creare la segnalazione'
    )
  }

  return dbToIssue(data)
}

export async function updateIssue(
  id,
  changes
) {
  requireSupabase()

  const allowed = {}

  const map = {
    urgency: 'priority',
    room: 'location',
    title: 'description',
    status: 'status',
    department: 'department',
    category: 'category',
    roomStatus: 'room_status',
    pieceName: 'waiting_part_name',
    completionNote:
      'completion_note',
    completedBy:
      'completed_by_name',
    pieceDecision:
      'piece_decision',
    pieceDecisionBy:
      'piece_decision_by',
    pieceReplaced:
      'piece_replaced',
    pieceReplacedBy:
      'piece_replaced_by',
    technicianRequestedBy:
      'technician_requested_by',
    externalTechnicianName:
      'external_technician_name',
    externalTechnicianPhone:
      'external_technician_phone',
    assignedTo: 'assigned_to',
  }

  Object.entries(map).forEach(
    ([appKey, dbKey]) => {
      if (
        Object.prototype.hasOwnProperty.call(
          changes,
          appKey
        )
      ) {
        allowed[dbKey] =
          changes[appKey] ?? null
      }
    }
  )

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'origin'
    )
  ) {
    allowed.source =
      normalizeSource(changes.origin)
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'completedAt'
    )
  ) {
    allowed.completed_at =
      changes.completedAt
        ? new Date(
            changes.completedAt
          ).toISOString()
        : null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'technicianRequestedAt'
    )
  ) {
    allowed.technician_requested_at =
      changes.technicianRequestedAt
        ? new Date(
            changes.technicianRequestedAt
          ).toISOString()
        : null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'createdByName'
    )
  ) {
    allowed.created_by_name =
      changes.createdByName ||
      null
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      'hotelId'
    )
  ) {
    allowed.hotel_id =
      changes.hotelId
  }

  if (!Object.keys(allowed).length) {
    return null
  }

  const { data, error } =
    await supabase
      .from('maintenance_issues')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single()

  if (error) {
    console.error(
      'updateIssue error',
      error
    )

    throw new Error(
      'Impossibile aggiornare la segnalazione'
    )
  }

  return dbToIssue(data)
}

export async function deleteIssue(id) {
  requireSupabase()

  const { error } =
    await supabase
      .from('maintenance_issues')
      .delete()
      .eq('id', id)

  if (error) {
    console.error(
      'deleteIssue error',
      error
    )

    throw new Error(
      'Impossibile eliminare la segnalazione'
    )
  }

  return true
}
