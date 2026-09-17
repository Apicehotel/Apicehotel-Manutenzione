export const RANDUI_ICON_VERSION = '1.0.0'

export const RANDUI_ICON_POLICY = Object.freeze({
  runtimeOwner: 'src/randapp/ui.jsx#Icon',
  approvedTargetSet: 'mingcute',
  migrationMode: 'adapter-first',
  rules: Object.freeze([
    'semantic-names-only',
    'one-runtime-icon-owner',
    'no-emoji-as-ui-icons',
    'decorative-icons-aria-hidden',
    'interactive-icons-require-accessible-label',
    'regular-default-filled-active',
    'currentColor-only',
  ]),
})

export const RANDUI_SEMANTIC_ICONS = Object.freeze({
  home: 'home', issues: 'issues', maintenance: 'wrench', planning: 'calendar', menu: 'menu',
  add: 'plus', search: 'search', filter: 'filter', previous: 'chevronLeft', next: 'chevronRight',
  expand: 'chevronDown', close: 'close', user: 'user', users: 'users', settings: 'gear',
  signOut: 'logout', notifications: 'bell', camera: 'camera', image: 'image', done: 'check',
  inventory: 'package', chat: 'message', phone: 'phone', temperature: 'thermometer',
  housekeeping: 'housekeeping', activity: 'activity', refresh: 'refresh', lock: 'lock',
  continue: 'arrowRight', hotel: 'hotel', security: 'shield', ai: 'sparkles', warning: 'warning',
  time: 'clock', guide: 'book', file: 'file', edit: 'edit', delete: 'trash', link: 'link',
  sensor: 'sensor', controls: 'sliders',
})

export function resolveRandUiIcon(semanticName) {
  return RANDUI_SEMANTIC_ICONS[semanticName] || semanticName || null
}
