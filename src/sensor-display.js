const COLLATOR = new Intl.Collator('it', { numeric: true, sensitivity: 'base' })

const WINE_CIRCUIT_RE = /^A([123])\s+da\s+(\d{3})\s+a\s+(\d{3})(.*)$/i

export function parseWineCircuit(name = '') {
  const match = String(name).trim().match(WINE_CIRCUIT_RE)
  if (!match) return null
  const circuit = Number.parseInt(match[1], 10)
  const firstRoom = Number.parseInt(match[2], 10)
  const lastRoom = Number.parseInt(match[3], 10)
  if (!Number.isFinite(circuit) || !Number.isFinite(firstRoom) || !Number.isFinite(lastRoom)) return null
  return {
    circuit,
    floor: Number.parseInt(String(firstRoom)[0], 10),
    firstRoom,
    lastRoom,
    extraRooms: match[4]
      .split('+')
      .map((value) => Number.parseInt(value.replace(/\D/g, ''), 10))
      .filter(Number.isFinite),
  }
}

export function displaySensorName(sensor) {
  const name = sensor?.nome?.trim() || sensor?.device_id || 'Dispositivo'
  const wine = parseWineCircuit(name)
  if (!wine) return name
  const roomRange = wine.firstRoom === wine.lastRoom ? `${wine.firstRoom}` : `${wine.firstRoom}–${wine.lastRoom}`
  const extras = wine.extraRooms.length ? `, ${wine.extraRooms.join(', ')}` : ''
  return `A${wine.circuit} · Camere ${roomRange}${extras}`
}

export function switchStatus(sensor) {
  if (!sensor?.online) return { key: 'unavailable', label: 'NON DISPONIBILE' }
  if (sensor?.switch_state === 'on') return { key: 'on', label: 'ATTIVO' }
  if (sensor?.switch_state === 'off') return { key: 'off', label: 'SPENTO' }
  if (sensor?.switch_state === 'mixed') return { key: 'mixed', label: 'STATO MISTO' }
  return { key: 'unavailable', label: 'NON DISPONIBILE' }
}

export function classifySwitch(sensor) {
  const name = sensor?.nome?.trim() || ''
  const wine = parseWineCircuit(name)
  if (wine) return { section: 'wine', sectionLabel: 'Camere Wine', sectionOrder: 10, subgroup: `Piano ${wine.floor}`, subgroupOrder: wine.floor, itemOrder: wine.circuit }
  if (/termobagno/i.test(name)) {
    const circuit = Number.parseInt(name.match(/^A([123])/i)?.[1] || '99', 10)
    return { section: 'termobagni', sectionLabel: 'Termobagni', sectionOrder: 20, subgroup: '', subgroupOrder: 0, itemOrder: circuit }
  }
  if (/\bhall\b/i.test(name)) return { section: 'hall', sectionLabel: 'Hall', sectionOrder: 30, subgroup: '', subgroupOrder: 0, itemOrder: 0 }
  if (/ristorante|colazion/i.test(name)) return { section: 'ristorante', sectionLabel: 'Ristorante e colazioni', sectionOrder: 40, subgroup: '', subgroupOrder: 0, itemOrder: 0 }
  if (/\bsala\b/i.test(name)) return { section: 'sale', sectionLabel: 'Sale', sectionOrder: 50, subgroup: '', subgroupOrder: 0, itemOrder: 0 }
  return { section: 'tecnici', sectionLabel: 'Servizi tecnici', sectionOrder: 60, subgroup: '', subgroupOrder: 0, itemOrder: 0 }
}

export function groupSwitches(sensors = []) {
  const switches = sensors.filter((sensor) => sensor?.temperatura == null)
  const mapped = switches.map((sensor) => ({ sensor, meta: classifySwitch(sensor) }))
  mapped.sort((a, b) => {
    if (a.meta.sectionOrder !== b.meta.sectionOrder) return a.meta.sectionOrder - b.meta.sectionOrder
    if (a.meta.subgroupOrder !== b.meta.subgroupOrder) return a.meta.subgroupOrder - b.meta.subgroupOrder
    if (a.meta.itemOrder !== b.meta.itemOrder) return a.meta.itemOrder - b.meta.itemOrder
    return COLLATOR.compare(a.sensor?.nome || '', b.sensor?.nome || '')
  })

  const sections = []
  for (const item of mapped) {
    let section = sections.find((entry) => entry.id === item.meta.section)
    if (!section) {
      section = { id: item.meta.section, label: item.meta.sectionLabel, groups: [] }
      sections.push(section)
    }
    const groupId = item.meta.subgroup || 'default'
    let group = section.groups.find((entry) => entry.id === groupId)
    if (!group) {
      group = { id: groupId, label: item.meta.subgroup, sensors: [] }
      section.groups.push(group)
    }
    group.sensors.push(item.sensor)
  }
  return sections
}

export function temperatureSensors(sensors = []) {
  return sensors
    .filter((sensor) => sensor?.temperatura != null)
    .slice()
    .sort((a, b) => (a?.ordine ?? 99) - (b?.ordine ?? 99) || COLLATOR.compare(a?.nome || '', b?.nome || ''))
}
