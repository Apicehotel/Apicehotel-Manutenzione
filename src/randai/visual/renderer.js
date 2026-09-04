import { layoutRandVisual } from './layout.js'

const escapeXml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const tokenDefaults = Object.freeze({
  paper: 'var(--rs-surface, #ffffff)',
  ink: 'var(--rs-text, #171717)',
  muted: 'var(--rs-text-muted, #666666)',
  border: 'var(--rs-border, #d8d8d8)',
  accent: 'var(--rs-accent, #2563eb)',
  accentSoft: 'var(--rs-accent-soft, #eff6ff)',
})

const point = (box, side) => {
  if (side === 'top') return { x: box.x + box.width / 2, y: box.y }
  if (side === 'bottom') return { x: box.x + box.width / 2, y: box.y + box.height }
  if (side === 'left') return { x: box.x, y: box.y + box.height / 2 }
  return { x: box.x + box.width, y: box.y + box.height / 2 }
}

const edgePath = (from, to, direction) => {
  if (direction === 'LR') {
    const a = point(from, 'right')
    const b = point(to, 'left')
    const mid = (a.x + b.x) / 2
    return { d: `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`, labelX: mid, labelY: (a.y + b.y) / 2 - 8 }
  }
  const a = point(from, 'bottom')
  const b = point(to, 'top')
  const mid = (a.y + b.y) / 2
  return { d: `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`, labelX: (a.x + b.x) / 2 + 8, labelY: mid - 6 }
}

export function renderRandVisualSvg(spec, { tokens = {} } = {}) {
  const theme = { ...tokenDefaults, ...tokens }
  const { width, height, positions } = layoutRandVisual(spec)
  const id = `rv-${String(spec.hotelId).replace(/[^a-zA-Z0-9_-]/g, '-')}-${String(spec.type).replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const parts = []

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" data-randvisual="1" data-diagram-type="${escapeXml(spec.type)}" data-hotel-id="${escapeXml(spec.hotelId)}">`)
  parts.push(`<title id="${id}-title">${escapeXml(spec.title)}</title>`)
  parts.push(`<desc id="${id}-desc">RandVisual ${escapeXml(spec.type)} diagram with ${spec.nodes.length} nodes and ${spec.edges.length} edges</desc>`)
  parts.push(`<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.muted}"/></marker></defs>`)
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="${theme.paper}"/>`)
  parts.push(`<text x="56" y="42" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${theme.ink}">${escapeXml(spec.title)}</text>`)

  for (const edge of spec.edges) {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    const path = edgePath(from, to, spec.direction)
    parts.push(`<path d="${path.d}" fill="none" stroke="${theme.muted}" stroke-width="1.5" marker-end="url(#${id}-arrow)"/>`)
    if (edge.label) parts.push(`<text x="${path.labelX}" y="${path.labelY}" font-family="system-ui, sans-serif" font-size="11" fill="${theme.muted}">${escapeXml(edge.label)}</text>`)
  }

  for (const node of spec.nodes) {
    const box = positions.get(node.id)
    const emphasized = node.emphasis === true
    parts.push(`<g data-node-id="${escapeXml(node.id)}" data-node-kind="${escapeXml(node.kind)}">`)
    parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14" fill="${emphasized ? theme.accentSoft : theme.paper}" stroke="${emphasized ? theme.accent : theme.border}" stroke-width="${emphasized ? 2 : 1}"/>`)
    parts.push(`<text x="${box.x + 16}" y="${box.y + 30}" font-family="system-ui, sans-serif" font-size="14" font-weight="650" fill="${theme.ink}">${escapeXml(node.label)}</text>`)
    if (node.subtitle) parts.push(`<text x="${box.x + 16}" y="${box.y + 51}" font-family="system-ui, sans-serif" font-size="11" fill="${theme.muted}">${escapeXml(node.subtitle)}</text>`)
    parts.push('</g>')
  }

  parts.push('</svg>')
  return { svg: parts.join(''), width, height }
}

export function assertSafeRandVisualSvg(svg) {
  const text = String(svg || '')
  const forbidden = [
    /<script\b/i,
    /<foreignObject\b/i,
    /<[^>]+\son[a-z]+\s*=/i,
    /<[^>]+\s(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i,
    /@import/i,
  ]
  for (const pattern of forbidden) if (pattern.test(text)) throw new Error(`Unsafe RandVisual SVG output: ${pattern}`)
  return true
}
