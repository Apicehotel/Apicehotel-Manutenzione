export const RANDAI_UI_FOUNDATION_VERSION = '1.0.0'

export const RANDAI_SURFACES = Object.freeze({
  QUICK_ASSISTANT: 'quick-assistant',
  CONTROL_CENTER: 'control-center',
})

export const RANDAI_UI_PRIMITIVES = Object.freeze([
  'conversation',
  'message',
  'source',
  'status',
  'reasoning',
  'plan',
  'tool',
  'composer',
])

export const RANDAI_UI_SOURCES = Object.freeze({
  canonicalOwner: 'RandUI',
  runtimeStack: 'React 19 + Vite 7',
  externalPatterns: Object.freeze([
    Object.freeze({ name: 'vercel/ai-elements', decision: 'ADOPT_PATTERN' }),
    Object.freeze({ name: 'crafter-station/elements', decision: 'SOURCE_ONLY' }),
    Object.freeze({ name: 'fantastic-admin/basic', decision: 'LAYOUT_REFERENCE' }),
    Object.freeze({ name: 'abuanwar072/E-commerce-Complete-Flutter-UI', decision: 'MOBILE_REFERENCE' }),
  ]),
})

export function resolveRandAISurface({ fullPage = false } = {}) {
  return fullPage ? RANDAI_SURFACES.CONTROL_CENTER : RANDAI_SURFACES.QUICK_ASSISTANT
}

export function assertRandAIPrimitive(name) {
  if (!RANDAI_UI_PRIMITIVES.includes(name)) {
    const error = new Error(`Unknown RandAI UI primitive: ${name}`)
    error.code = 'RANDAI_UI_UNKNOWN_PRIMITIVE'
    throw error
  }
  return name
}
