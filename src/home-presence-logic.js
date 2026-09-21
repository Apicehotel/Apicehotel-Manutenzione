/** Matches server auto-expire window (7h20). */
export const PRESENCE_MAX_MS = (7 * 60 + 20) * 60 * 1000

/** Roles that can mark presence and appear in the Home colleague widget. */
export const PRESENCE_DISPLAY_ROLES = Object.freeze(new Set([
  'manutentore',
  'Portiere Notturno',
  'admin',
]))

export function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function namesMatch(a, b) {
  const left = normalizePersonName(a)
  const right = normalizePersonName(b)
  if (!left || !right) return false
  if (left === right) return true
  return String(a || '').localeCompare(String(b || ''), 'it', { sensitivity: 'base' }) === 0
}

export function isPresenceActive(person, now = Date.now()) {
  if (!person?.in_struttura) return false
  const since = person.in_struttura_dal ? new Date(person.in_struttura_dal).getTime() : 0
  return Boolean(since) && now - since < PRESENCE_MAX_MS
}

/**
 * Join people currently in structure with open urgents they took (presa_in_carico).
 * Busy = at least one active urgent owned by that name.
 */
export function buildColleaguePresenceRows({ people = [], urgents = [], now = Date.now() } = {}) {
  const taken = (urgents || []).filter((item) => item?.status === 'presa_in_carico' && item?.takenBy)

  return (people || [])
    .filter((person) => (
      person?.active !== false
      && person?.nome
      && PRESENCE_DISPLAY_ROLES.has(person.ruolo)
      && isPresenceActive(person, now)
    ))
    .map((person) => {
      const assigned = taken.filter((item) => namesMatch(person.nome, item.takenBy))
      const locations = assigned
        .map((item) => item.location || item.note)
        .filter(Boolean)
        .slice(0, 2)
      return {
        id: person.id || normalizePersonName(person.nome),
        name: person.nome,
        role: person.ruolo,
        since: person.in_struttura_dal || null,
        busy: assigned.length > 0,
        takenCount: assigned.length,
        detail: assigned.length
          ? (locations.length ? locations.join(' · ') : `${assigned.length} avvis${assigned.length === 1 ? 'o' : 'i'} in carico`)
          : 'Libero',
      }
    })
    .sort((a, b) => Number(b.busy) - Number(a.busy) || a.name.localeCompare(b.name, 'it'))
}
