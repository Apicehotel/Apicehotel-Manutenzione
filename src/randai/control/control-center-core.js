const toInt = (value) => Number.parseInt(value, 10)

function valuesFor(field, min, max) {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const step = field.match(/^\*\/(\d+)$/)
  if (step) {
    const n = Math.max(1, toInt(step[1]))
    return Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((v) => (v - min) % n === 0)
  }
  const values = field.split(',').map(toInt).filter((v) => Number.isInteger(v) && v >= min && v <= max)
  return [...new Set(values)].sort((a, b) => a - b)
}

export function nextCronRun(schedule, from = new Date()) {
  const parts = String(schedule || '').trim().split(/\s+/)
  if (parts.length !== 5 || parts.slice(2).some((part) => part !== '*')) return null
  const minutes = new Set(valuesFor(parts[0], 0, 59))
  const hours = new Set(valuesFor(parts[1], 0, 23))
  if (!minutes.size || !hours.size) return null
  const cursor = new Date(from.getTime())
  cursor.setUTCSeconds(0, 0)
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)
  for (let i = 0; i < 60 * 24 * 8; i += 1) {
    if (minutes.has(cursor.getUTCMinutes()) && hours.has(cursor.getUTCHours())) return new Date(cursor)
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)
  }
  return null
}

export function workerHealth(worker) {
  const last = worker?.last_run
  if (!last) return { state: 'warn', label: 'Mai eseguito' }
  if (Number(worker?.recent_failures || 0) > 0 || !['success', 'succeeded'].includes(String(last.status || '').toLowerCase())) return { state: 'bad', label: 'Errore' }
  return { state: 'good', label: 'OK' }
}

export function anomalySummary(anomalies = []) {
  return anomalies.reduce((acc, item) => {
    const key = String(item?.severity || 'medium').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function observedCost(observability = {}) {
  if (!observability?.cost_available || observability?.cost_usd == null) return { available: false, label: 'Non disponibile' }
  const value = Number(observability.cost_usd)
  return { available: Number.isFinite(value), value: Number.isFinite(value) ? value : null, label: Number.isFinite(value) ? `$${value.toFixed(4)}` : 'Non disponibile' }
}
