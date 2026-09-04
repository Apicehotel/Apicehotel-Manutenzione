const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function layoutRandVisual(spec) {
  const direction = spec.direction || 'TB'
  const nodeWidth = 190
  const nodeHeight = 72
  const gapPrimary = 118
  const gapSecondary = 42
  const padding = 56

  const layers = new Map()
  for (const node of spec.nodes) {
    const layer = Number(node.layer || 0)
    const list = layers.get(layer) || []
    list.push(node)
    layers.set(layer, list)
  }

  const orderedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0])
  const maxSecondaryCount = Math.max(1, ...orderedLayers.map(([, nodes]) => nodes.length))
  const primaryCount = Math.max(1, orderedLayers.length)
  const secondarySpan = maxSecondaryCount * nodeWidth + Math.max(0, maxSecondaryCount - 1) * gapSecondary
  const primarySpan = primaryCount * nodeHeight + Math.max(0, primaryCount - 1) * gapPrimary

  const width = direction === 'LR' ? clamp(primarySpan + padding * 2, 420, 3600) : clamp(secondarySpan + padding * 2, 420, 3600)
  const height = direction === 'LR' ? clamp(secondarySpan * 0.52 + padding * 2 + 60, 300, 2400) : clamp(primarySpan + padding * 2 + 60, 300, 2400)
  const positions = new Map()

  for (let layerIndex = 0; layerIndex < orderedLayers.length; layerIndex += 1) {
    const [, nodes] = orderedLayers[layerIndex]
    const rowSpan = nodes.length * nodeWidth + Math.max(0, nodes.length - 1) * gapSecondary
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (direction === 'LR') {
        const x = padding + layerIndex * (nodeWidth + gapPrimary)
        const y = padding + 56 + index * (nodeHeight + gapSecondary)
        positions.set(node.id, { x, y, width: nodeWidth, height: nodeHeight })
      } else {
        const x = (width - rowSpan) / 2 + index * (nodeWidth + gapSecondary)
        const y = padding + 56 + layerIndex * (nodeHeight + gapPrimary)
        positions.set(node.id, { x, y, width: nodeWidth, height: nodeHeight })
      }
    }
  }

  return { width, height, positions }
}
