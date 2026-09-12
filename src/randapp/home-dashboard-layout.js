export const HOME_DASHBOARD_CARDS = ['status', 'priority', 'planning', 'operations', 'structure', 'randai']

const clampSpan = (value) => Math.max(1, Math.min(3, Number(value) || 1))

function packCompact(ids) {
  if (ids.length <= 1) return ids.map((id) => [id, 3])
  if (ids.length === 2) return [[ids[0], 2], [ids[1], 1]]
  return ids.map((id) => [id, 1])
}

function packNormal(ids) {
  if (ids.length <= 1) return ids.map((id) => [id, 3])
  if (ids.length === 2) return [[ids[0], 2], [ids[1], 1]]
  const rows = []
  for (let index = 0; index < ids.length; index += 2) {
    const pair = ids.slice(index, index + 2)
    if (pair.length === 1) rows.push([pair[0], 3])
    else rows.push([pair[0], 2], [pair[1], 1])
  }
  return rows
}

function withRows(entries) {
  let row = 1
  let used = 0
  return entries.map(([id, rawSpan]) => {
    const span = clampSpan(rawSpan)
    if (used > 0 && used + span > 3) { row += 1; used = 0 }
    const item = { id, row, span, state: `${row}:${span}` }
    used += span
    if (used === 3) { row += 1; used = 0 }
    return item
  })
}

export function resolveHomeDashboardLayout(visibleIds, uiSize = 'normal') {
  const ids = HOME_DASHBOARD_CARDS.filter((id) => visibleIds.includes(id))
  if (!ids.length) return []

  const pinned = ids.filter((id) => id === 'status' || id === 'priority')
  const rest = ids.filter((id) => !pinned.includes(id))
  const entries = pinned.map((id) => [id, 3])

  if (uiSize === 'large') entries.push(...rest.map((id) => [id, 3]))
  else if (uiSize === 'small') entries.push(...packCompact(rest))
  else entries.push(...packNormal(rest))

  return withRows(entries)
}
