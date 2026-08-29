export function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function extractRoomNumber(query) {
  const text = normalizeText(query)
  const match = text.match(/(?:camera|stanza|cam\.?)[\s:#-]*(\d{3,4})\b/) || text.match(/\b(\d{3,4})\b/)
  return match ? Number(match[1]) : null
}

export function extractJazzFloor(query) {
  const text = normalizeText(query)
  const direct = text.match(/(?:piano|p\.?)[\s-]*([1-4])\b/)
  if (direct) return Number(direct[1])
  if (/\b(primo|1°)\b/.test(text)) return 1
  if (/\b(secondo|2°)\b/.test(text)) return 2
  if (/\b(terzo|3°)\b/.test(text)) return 3
  if (/\b(quarto|4°)\b/.test(text)) return 4
  const room = extractRoomNumber(text)
  if (room >= 1000 && room <= 4999) {
    const floor = Math.floor(room / 1000)
    if (floor >= 1 && floor <= 4) return floor
  }
  return null
}

export function inferHvacMode(query) {
  const text = normalizeText(query)
  const cooling = ['fredd', 'raffresc', 'condizion', 'aria fresca'].some((token) => text.includes(token))
  const heating = ['cald', 'riscald', 'aria calda'].some((token) => text.includes(token))
  if (cooling && !heating) return 'cooling'
  if (heating && !cooling) return 'heating'
  return 'unknown'
}

export function selectHvacZone(zones, query) {
  const text = normalizeText(query)
  const room = extractRoomNumber(text)
  const explicitlyJazz = text.includes('jazz')
  const explicitlyWine = text.includes('wine')

  if (room) {
    const mapped = zones.find((zone) => Array.isArray(zone.room_numbers) && zone.room_numbers.includes(room))
    if (mapped && (!explicitlyJazz || mapped.section === 'jazz') && (!explicitlyWine || mapped.section === 'wine')) {
      return { zone: mapped, room, resolution: `${mapped.section}-room-map` }
    }
  }

  if (explicitlyJazz || (room && room >= 1000)) {
    const floor = extractJazzFloor(text)
    if (floor) {
      const jazz = zones.find((zone) => zone.section === 'jazz' && Number(zone.floor) === floor)
      if (jazz) return { zone: jazz, room, resolution: room ? 'jazz-room-floor' : 'jazz-floor' }
    }
  }

  return null
}

export function relayStatus(sensor) {
  if (!sensor) return { key: 'unknown', label: 'STATO NON DISPONIBILE' }
  if (!sensor.online) return { key: 'unavailable', label: 'NON DISPONIBILE' }
  if (sensor.switch_state === 'on') return { key: 'on', label: 'ATTIVO' }
  if (sensor.switch_state === 'off') return { key: 'off', label: 'SPENTO' }
  if (sensor.switch_state === 'mixed') return { key: 'mixed', label: 'STATO MISTO' }
  return { key: 'unknown', label: 'STATO NON DISPONIBILE' }
}

function stale(updatedAt, now = Date.now(), maxAgeMinutes = 30) {
  if (!updatedAt) return true
  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) return true
  return now - timestamp > maxAgeMinutes * 60_000
}

export function buildHvacDiagnostic({ zone, room = null, mode = 'unknown', sensors = [], now = Date.now() }) {
  const byId = new Map(sensors.map((sensor) => [sensor.device_id, sensor]))
  const switchSensor = zone.switch_device_id ? byId.get(zone.switch_device_id) || null : null
  const temperatures = (zone.temperature_device_ids || []).map((deviceId) => byId.get(deviceId)).filter(Boolean).map((sensor) => ({
    device_id: sensor.device_id,
    name: sensor.nome,
    temperature: sensor.temperatura,
    online: Boolean(sensor.online),
    alert: Boolean(sensor.in_allerta),
    updated_at: sensor.aggiornato_il,
    stale: stale(sensor.aggiornato_il, now),
  }))
  const relay = relayStatus(switchSensor)
  const hasMissingTemperature = (zone.temperature_device_ids || []).length !== temperatures.length
  const hasOfflineTemperature = temperatures.some((sensor) => !sensor.online)
  const hasStaleTemperature = temperatures.some((sensor) => sensor.stale)

  let conclusion = 'insufficient-data'
  if (zone.section === 'wine') {
    if (hasMissingTemperature || hasOfflineTemperature || hasStaleTemperature) conclusion = 'check-upstream-data'
    else if (relay.key === 'off') conclusion = 'circuit-off'
    else if (relay.key === 'on') conclusion = 'circuit-on-check-downstream'
    else conclusion = 'check-circuit-state'
  } else if (zone.section === 'jazz') {
    if (hasMissingTemperature || hasOfflineTemperature || hasStaleTemperature) conclusion = 'check-floor-temperature-data'
    else if (!zone.switch_device_id) conclusion = 'floor-temperature-available-switch-unmapped'
    else if (relay.key === 'off') conclusion = 'floor-circuit-off'
    else if (relay.key === 'on') conclusion = 'floor-circuit-on-check-downstream'
  }

  return {
    type: 'hvac',
    hotel_id: zone.hotel_id,
    section: zone.section,
    floor: zone.floor,
    circuit: zone.circuit,
    zone_id: zone.zone_id,
    zone_label: zone.label,
    room,
    mode,
    switch: zone.switch_device_id ? {
      device_id: zone.switch_device_id,
      online: switchSensor ? Boolean(switchSensor.online) : false,
      state: switchSensor?.switch_state || null,
      status_key: relay.key,
      status_label: relay.label,
      updated_at: switchSensor?.aggiornato_il || null,
      stale: switchSensor ? stale(switchSensor.aggiornato_il, now) : true,
    } : null,
    temperatures,
    thresholds_defined: false,
    conclusion,
  }
}
