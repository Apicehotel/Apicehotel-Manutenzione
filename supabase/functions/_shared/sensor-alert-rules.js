// Shared by the sensor worker and the UI so changing season updates the
// displayed classification immediately, without inventing a new measurement.
export function evaluateSensorAlert(role, temperature, online, rules) {
  if (!online || temperature == null || !Number.isFinite(Number(temperature))) {
    return { in_allerta: false, soglia: null, allerta_tipo: null }
  }
  const kind = role === 'motore' ? (rules.stagione === 'inverno' ? 'sotto' : 'sopra') : role === 'frigo' ? 'sopra' : null
  const threshold = role === 'motore'
    ? (rules.stagione === 'inverno' ? rules.soglia_inverno_min : rules.soglia_estate_max)
    : role === 'frigo' ? rules.soglia_frigo_max : null
  if (!kind || threshold == null || !Number.isFinite(Number(threshold))) {
    return { in_allerta: false, soglia: null, allerta_tipo: null }
  }
  return { in_allerta: kind === 'sotto' ? Number(temperature) < Number(threshold) : Number(temperature) > Number(threshold), soglia: Number(threshold), allerta_tipo: kind }
}
