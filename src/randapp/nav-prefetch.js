/**
 * Warm lazy view chunks for bottom-nav destinations before Suspense.
 * Factories must stay aligned with Shell.jsx lazyWithRetry import paths.
 */

const VIEW_IMPORTS = Object.freeze({
  operations: () => import('./operations/OperationsHub.jsx'),
  issues: () => import('./Issues.jsx'),
  interventions: () => import('./operations/InterventionsView.jsx'),
  'planning-work': () => import('./PlanningHub.jsx'),
  'planning-sale': () => import('./PlanningHub.jsx'),
  'my-work': () => import('./operations/TaskView.jsx'),
  urgent: () => import('./operations/UrgentView.jsx'),
  reminders: () => import('./reminders/RemindersView.jsx'),
  chat: () => import('./chat/ChatGroups.jsx'),
  profile: () => import('./Profile.jsx'),
  inventory: () => import('./InventoryView.jsx'),
  supplies: () => import('./SupplyRequestsPortal.jsx'),
  housekeeping: () => import('../housekeeping.jsx'),
  randai: () => import('../randai/RandAIAssistant.jsx'),
  settings: () => import('./Settings.jsx'),
})

const warmed = new Set()

/** Expand hub destinations to the screens operators open next. */
export function relatedPrefetchIds(viewId) {
  if (viewId === 'operations') return ['operations', 'issues', 'interventions']
  if (viewId === 'my-work') return ['my-work', 'urgent', 'reminders']
  if (viewId === 'planning-work' || viewId === 'planning-sale') return ['planning-work']
  return viewId ? [viewId] : []
}

export function prefetchView(viewId) {
  const factory = VIEW_IMPORTS[viewId]
  if (!factory || warmed.has(viewId)) return Promise.resolve()
  warmed.add(viewId)
  return factory().catch(() => {
    warmed.delete(viewId)
  })
}

export function prefetchViews(viewIds = []) {
  const ids = [...new Set(viewIds.flatMap((id) => relatedPrefetchIds(id)))]
  return Promise.all(ids.map((id) => prefetchView(id)))
}

export function scheduleNavPrefetch(viewIds = []) {
  if (typeof window === 'undefined') return () => {}
  const run = () => { void prefetchViews(viewIds) }
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: 2500 })
    return () => window.cancelIdleCallback?.(handle)
  }
  const timer = window.setTimeout(run, 350)
  return () => window.clearTimeout(timer)
}
