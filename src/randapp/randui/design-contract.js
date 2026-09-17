import { RANDUI_ICON_POLICY } from './icon-contract.js'
import { RANDUI_MOTION, RANDUI_MOTION_VERSION } from './motion-contract.js'
import designTokens from './design-tokens.json' with { type: 'json' }

export const RANDUI_VERSION = '1.0.0'
export const RANDUI_STANDARDIZATION_VERSION = '1.0.0'

export const RANDUI_BREAKPOINTS = Object.freeze({
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1199,
  desktopMin: 1200,
})

export const RANDUI_DENSITIES = Object.freeze(['small', 'normal', 'large'])

export const RANDUI_LAYER_OWNERS = Object.freeze({
  primitives: 'src/randapp/ui.jsx',
  chromeVisuals: 'src/randapp/shell.css',
  responsiveGeometry: 'src/randapp/adaptive-layout.css',
  interactionAccessibility: 'src/randapp/ui-coherence.css',
  finalFoundation: 'src/randapp/randui/foundation.css',
  designTokens: 'src/randapp/randui/design-tokens.json',
  motion: 'src/randapp/randui/motion-contract.js',
  icons: 'src/randapp/randui/icon-contract.js',
  templates: 'src/randapp/randui/template-registry.js',
  components: 'src/randapp/randui/component-registry.js',
  pageSchema: 'src/randapp/randui/page-schema.js',
  systemStates: 'src/randapp/randui/system-states.jsx',
  guard: 'src/randapp/randui/guard.js',
})

export const RANDUI_SYSTEM_STATES = Object.freeze([
  'loading', 'empty', 'no-results', 'error', 'degraded', 'offline', 'queued', 'syncing',
  'stale', 'conflict', 'forbidden', 'unavailable', 'success', 'warning', 'in-progress',
])

export const RANDUI_TEMPLATE_IDS = Object.freeze([
  'dashboard', 'list', 'list-detail', 'master-detail', 'operational', 'planning', 'form',
  'wizard', 'settings', 'management', 'monitor', 'system-state', 'auth', 'search-archive',
])

export const RANDUI_DESIGN_CONTRACT = Object.freeze({
  version: RANDUI_VERSION,
  standardizationVersion: RANDUI_STANDARDIZATION_VERSION,
  breakpoints: RANDUI_BREAKPOINTS,
  densities: RANDUI_DENSITIES,
  templateIds: RANDUI_TEMPLATE_IDS,
  systemStates: RANDUI_SYSTEM_STATES,
  layerOwners: RANDUI_LAYER_OWNERS,
  tokens: designTokens,
  motionVersion: RANDUI_MOTION_VERSION,
  motion: RANDUI_MOTION,
  iconPolicy: RANDUI_ICON_POLICY,
  invariants: Object.freeze([
    'one-authenticated-shell',
    'one-responsive-geometry-owner',
    'one-theme-contract',
    'one-density-contract',
    'one-design-token-contract',
    'one-motion-contract',
    'one-icon-runtime-owner',
    'permissions-before-personalization',
    'no-unintended-horizontal-overflow',
    'safe-area-owned-by-shared-chrome',
    'templates-before-page-specific-layout',
    'registered-components-only',
    'reduced-motion-is-mandatory',
    'guard-before-template-migration',
  ]),
})

export function classifyRandUiViewport(width = 0) {
  const value = Number(width) || 0
  if (value >= RANDUI_BREAKPOINTS.desktopMin) return 'desktop'
  if (value >= RANDUI_BREAKPOINTS.tabletMin) return 'tablet'
  return 'mobile'
}

export function normalizeRandUiDensity(value) {
  return RANDUI_DENSITIES.includes(value) ? value : 'normal'
}
