import { isRegisteredRandUiComponent } from './component-registry.js'
import { normalizeRandUiDensity } from './design-contract.js'
import { resolveRandUiTemplate } from './template-registry.js'

const PAGE_TYPE_ALIASES = Object.freeze({
  detail: 'list-detail',
  archive: 'search-archive',
  search: 'search-archive',
  admin: 'management',
  configuration: 'settings',
  status: 'monitor',
})

const asArray = (value) => Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : []

export function normalizeRandUiPageSchema(schema = {}) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new TypeError('RandUI page schema must be an object')
  const id = String(schema.id || '').trim()
  if (!id) throw new Error('RandUI page schema requires id')
  const requestedType = String(schema.pageType || '').trim()
  const pageType = PAGE_TYPE_ALIASES[requestedType] || requestedType
  const template = resolveRandUiTemplate(pageType)
  if (!template) throw new Error(`Unknown RandUI page type: ${requestedType || '(empty)'}`)
  return Object.freeze({
    id,
    domain: String(schema.domain || 'shared'),
    pageType,
    density: normalizeRandUiDensity(schema.density || template.defaultDensity || 'normal'),
    mobilePriority: Boolean(schema.mobilePriority),
    permissions: Object.freeze(asArray(schema.permissions)),
    capabilities: Object.freeze(asArray(schema.capabilities)),
    slots: Object.freeze({ ...(schema.slots || {}) }),
    template,
  })
}

export function resolveRandUiPage(schema) {
  const page = normalizeRandUiPageSchema(schema)
  return Object.freeze({
    ...page,
    allowedComponents: page.template.allowedComponents,
    responsive: page.template.responsive,
  })
}

export function assertRandUiComponentAllowed(schema, componentId) {
  if (!isRegisteredRandUiComponent(componentId)) throw new Error(`Unregistered RandUI component: ${componentId}`)
  const page = resolveRandUiPage(schema)
  if (!page.allowedComponents.includes(componentId)) throw new Error(`Component ${componentId} is not allowed by template ${page.pageType}`)
  return true
}
