import { isRegisteredRandUiComponent } from './component-registry.js'
import { resolveRandUiPage } from './page-schema.js'
import { resolveRandUiTemplate } from './template-registry.js'

export const RANDUI_GUARD_VERSION = 1
export const RANDUI_TOUCH_TARGET_MIN = 44
export const RANDUI_GUARD_TOLERANCE = 1

export const RANDUI_GUARD_VIEWPORTS = Object.freeze([
  Object.freeze({ name:'iphone-se-320x568', width:320, height:568 }),
  Object.freeze({ name:'phone-375x667', width:375, height:667 }),
  Object.freeze({ name:'iphone-390x844', width:390, height:844 }),
  Object.freeze({ name:'large-phone-430x932', width:430, height:932 }),
  Object.freeze({ name:'tablet-768x1024', width:768, height:1024 }),
  Object.freeze({ name:'tablet-1024x768', width:1024, height:768 }),
  Object.freeze({ name:'desktop-1440x1000', width:1440, height:1000 }),
])

const violation = (code, message, subject = null) => Object.freeze({ code, message, subject })
const uniqueStrings = (value) => Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : []
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export function auditRandUiComposition(schema, composition = {}) {
  const violations = []
  let page = null
  try {
    page = resolveRandUiPage(schema)
  } catch (error) {
    return Object.freeze([violation('invalid-page-schema', error.message, schema?.id || null)])
  }

  for (const componentId of uniqueStrings(composition.components)) {
    if (!isRegisteredRandUiComponent(componentId)) {
      violations.push(violation('unregistered-component', `Component ${componentId} is not registered`, componentId))
    } else if (!page.allowedComponents.includes(componentId)) {
      violations.push(violation('component-not-allowed', `Component ${componentId} is not allowed by template ${page.pageType}`, componentId))
    }
  }

  for (const slotId of uniqueStrings(composition.slots)) {
    if (!page.template.slots.includes(slotId)) {
      violations.push(violation('slot-not-allowed', `Slot ${slotId} is not declared by template ${page.pageType}`, slotId))
    }
  }

  return Object.freeze(violations)
}

export function assertRandUiComposition(schema, composition = {}) {
  const violations = auditRandUiComposition(schema, composition)
  if (violations.length) throw new Error(`RandUI composition guard failed: ${violations.map((item) => item.message).join('; ')}`)
  return true
}

export function auditRandUiGeometry(snapshot = {}) {
  const violations = []
  const viewportWidth = finite(snapshot.viewportWidth)
  const documentWidth = finite(snapshot.documentWidth)
  const tolerance = finite(snapshot.tolerance, RANDUI_GUARD_TOLERANCE)
  const touchMin = finite(snapshot.touchTargetMin, RANDUI_TOUCH_TARGET_MIN)

  if (viewportWidth <= 0) return Object.freeze([violation('invalid-viewport', 'Viewport width must be greater than zero')])
  if (documentWidth - viewportWidth > tolerance) {
    violations.push(violation('horizontal-overflow', `Document exceeds viewport by ${Math.round(documentWidth - viewportWidth)}px`, 'document'))
  }

  for (const node of Array.isArray(snapshot.nodes) ? snapshot.nodes : []) {
    if (!node || node.visible === false) continue
    const subject = String(node.subject || node.selector || node.tag || 'node')
    const left = finite(node.left)
    const right = finite(node.right, left + finite(node.width))
    const width = finite(node.width, Math.max(0, right - left))
    const height = finite(node.height)

    if (!node.allowViewportEscape && (left < -tolerance || right > viewportWidth + tolerance)) {
      violations.push(violation('viewport-escape', `${subject} escapes the viewport (${Math.round(left)}..${Math.round(right)} / ${viewportWidth}px)`, subject))
    }

    if (node.actionable && !node.disabled && !node.touchExempt && (width + tolerance < touchMin || height + tolerance < touchMin)) {
      violations.push(violation('touch-target', `${subject} is ${Math.round(width)}x${Math.round(height)}px; minimum is ${touchMin}px`, subject))
    }

    if (node.actionable && !node.disabled && !String(node.accessibleName || '').trim()) {
      violations.push(violation('accessible-name', `${subject} has no accessible name`, subject))
    }
  }

  for (const template of Array.isArray(snapshot.templates) ? snapshot.templates : []) {
    const id = String(template?.id || '')
    if (!resolveRandUiTemplate(id)) violations.push(violation('unknown-template', `Rendered template ${id || '(empty)'} is not registered`, id || null))
    if (finite(template?.h1Count) > 1) violations.push(violation('multiple-h1', `Template ${id || '(unknown)'} renders more than one h1`, id || null))
  }

  for (const id of uniqueStrings(snapshot.duplicateIds)) {
    violations.push(violation('duplicate-id', `Duplicate DOM id: ${id}`, id))
  }

  return Object.freeze(violations)
}

export function assertRandUiGeometry(snapshot = {}, label = 'RandUI') {
  const violations = auditRandUiGeometry(snapshot)
  if (violations.length) throw new Error(`${label} layout guard failed: ${violations.map((item) => `${item.code}: ${item.message}`).join(' | ')}`)
  return true
}
