import { supabase } from '../supabase.js'

async function invoke(body) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.functions.invoke('randai-issue-workspace', { body })
  if (error) throw error
  if (!data?.ok) {
    const err = new Error(data?.error || 'randai_issue_workspace_unavailable')
    err.code = data?.error || 'randai_issue_workspace_unavailable'
    throw err
  }
  return data
}

export async function getIssueWorkspace({ hotelId, issueId } = {}) {
  if (!hotelId || !issueId) return null
  const result = await invoke({ operation: 'summary', hotel_id: hotelId, issue_id: String(issueId) })
  return result.task || null
}

export async function startIssueWorkspace({ hotelId, issueId, procedureId = null } = {}) {
  if (!hotelId || !issueId) throw new TypeError('hotelId e issueId sono obbligatori')
  const result = await invoke({ operation: 'start', hotel_id: hotelId, issue_id: String(issueId), procedure_id: procedureId || null })
  return result.task || null
}

export async function confirmIssueWorkspaceStep({ hotelId, issueId, taskId, note = '' } = {}) {
  if (!hotelId || !issueId || !taskId) throw new TypeError('hotelId, issueId e taskId sono obbligatori')
  const result = await invoke({ operation: 'advance', hotel_id: hotelId, issue_id: String(issueId), task_id: taskId, note: String(note || '').trim().slice(0, 500) })
  return result.task || null
}

export async function prepareIssueCompletionSummary({ hotelId, issueId, taskId } = {}) {
  if (!hotelId || !issueId || !taskId) throw new TypeError('hotelId, issueId e taskId sono obbligatori')
  const result = await invoke({ operation: 'completion_summary', hotel_id: hotelId, issue_id: String(issueId), task_id: taskId })
  return result.summary || ''
}

export function issueWorkspaceProgress(task) {
  if (!task) return null
  const completed = Number(task.completedSteps || 0)
  const total = Number(task.totalSteps || 0)
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    label: total > 0 ? `${completed}/${total} passaggi` : 'Percorso pronto',
    next: task.nextStepTitle || null,
    status: task.status || 'PAUSED',
  }
}
