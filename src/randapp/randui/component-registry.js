const freezeStates = (states) => Object.freeze([...states])

const entry = (source, states, role) => Object.freeze({
  source,
  states: freezeStates(states),
  role,
})

export const RANDUI_COMPONENT_REGISTRY = Object.freeze({
  Icon: entry('../ui.jsx', ['default', 'disabled'], 'decoration'),
  Button: entry('../ui.jsx', ['default', 'hover', 'focus', 'active', 'disabled', 'loading'], 'action'),
  IconButton: entry('../ui.jsx', ['default', 'hover', 'focus', 'active', 'disabled', 'loading'], 'action'),
  Card: entry('../ui.jsx', ['default', 'loading', 'empty', 'error', 'disabled'], 'surface'),
  Field: entry('../ui.jsx', ['default', 'focus', 'disabled', 'error', 'read-only'], 'form'),
  TextInput: entry('../ui.jsx', ['default', 'focus', 'disabled', 'error', 'read-only'], 'form'),
  Badge: entry('../ui.jsx', ['default', 'success', 'warning', 'error', 'disabled'], 'status'),
  Segmented: entry('../ui.jsx', ['default', 'focus', 'active', 'disabled'], 'navigation'),
  Spinner: entry('../ui.jsx', ['loading'], 'feedback'),
  EmptyState: entry('../ui.jsx', ['empty', 'no-results', 'forbidden', 'unavailable'], 'feedback'),
  Sheet: entry('../ui.jsx', ['default', 'loading', 'error', 'disabled'], 'overlay'),
  Modal: entry('../ui.jsx', ['default', 'loading', 'error', 'disabled'], 'overlay'),
  ConfirmDialog: entry('../ui.jsx', ['default', 'loading', 'error', 'disabled'], 'overlay'),
  UiSizeControl: entry('../ui.jsx', ['default', 'focus', 'active', 'disabled'], 'preference'),
  ThemeControl: entry('../ui.jsx', ['default', 'focus', 'active', 'disabled'], 'preference'),
  PageTitle: entry('./visual-primitives.jsx', ['default'], 'heading'),
  Surface: entry('./visual-primitives.jsx', ['default', 'loading', 'empty', 'error', 'disabled'], 'surface'),
  Stack: entry('./visual-primitives.jsx', ['default'], 'layout'),
  Grid: entry('./visual-primitives.jsx', ['default'], 'layout'),
  Metric: entry('./visual-primitives.jsx', ['default', 'success', 'warning', 'error'], 'metric'),
  LayeredCard: entry('./advanced-primitives.jsx', ['default', 'hover', 'active', 'disabled'], 'surface'),
  StatCard: entry('./advanced-primitives.jsx', ['default', 'hover', 'active', 'success', 'warning', 'error'], 'metric'),
  StatusChip: entry('./advanced-primitives.jsx', ['default', 'success', 'warning', 'error', 'disabled'], 'status'),
  ProgressMeter: entry('./advanced-primitives.jsx', ['default', 'success', 'warning', 'error'], 'metric'),
  ActivityTimeline: entry('./advanced-primitives.jsx', ['default', 'empty'], 'activity'),
  DataList: entry('./advanced-primitives.jsx', ['default', 'empty', 'hover', 'active'], 'list'),
  CommandSurface: entry('./advanced-primitives.jsx', ['default', 'hover', 'active', 'disabled'], 'action-group'),
  SkeletonBlock: entry('./advanced-primitives.jsx', ['loading'], 'feedback'),
  SystemState: entry('./system-states.jsx', ['loading', 'empty', 'no-results', 'error', 'degraded', 'offline', 'queued', 'syncing', 'stale', 'conflict', 'forbidden', 'unavailable', 'success', 'warning', 'in-progress'], 'feedback'),
  TemplateFrame: entry('./templates.jsx', ['default', 'loading', 'empty', 'error', 'disabled'], 'layout'),
})

export const RANDUI_COMPONENT_IDS = Object.freeze(Object.keys(RANDUI_COMPONENT_REGISTRY))

export function randUiComponent(id) {
  return RANDUI_COMPONENT_REGISTRY[id] || null
}

export function isRegisteredRandUiComponent(id) {
  return Boolean(randUiComponent(id))
}

export function listRandUiComponents() {
  return RANDUI_COMPONENT_IDS.map((id) => Object.freeze({ id, ...RANDUI_COMPONENT_REGISTRY[id] }))
}

export function supportsRandUiState(componentId, state) {
  return Boolean(randUiComponent(componentId)?.states.includes(state))
}
