const cacheKey = (hotelId) => `randapp.sensors.v1.${hotelId}`

export function readSensorCache(hotelId) {
  if (typeof localStorage === 'undefined' || !hotelId) return []
  try {
    const raw = localStorage.getItem(cacheKey(hotelId))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed?.sensors) ? parsed.sensors : []
  } catch {
    return []
  }
}

export function writeSensorCache(hotelId, sensors) {
  if (typeof localStorage === 'undefined' || !hotelId) return
  try {
    localStorage.setItem(cacheKey(hotelId), JSON.stringify({
      savedAt: Date.now(),
      sensors: Array.isArray(sensors) ? sensors : [],
    }))
  } catch {
    /* quota / private mode */
  }
}

export function partitionTemperatureSensors(sensors = []) {
  const alerts = []
  const offline = []
  const ok = []
  for (const sensor of sensors) {
    if (!sensor?.online) offline.push(sensor)
    else if (sensor.in_allerta) alerts.push(sensor)
    else ok.push(sensor)
  }
  const byName = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'it')
  alerts.sort(byName)
  offline.sort(byName)
  ok.sort((a, b) => (a?.ordine ?? 99) - (b?.ordine ?? 99) || byName(a, b))
  return { alerts, offline, ok }
}
