/** Normalize login query/name for case-insensitive Italian matching. */
export const normalizeLoginName = (value) => String(value || '').trim().toLocaleLowerCase('it')

/**
 * Resolve a login directory user from typed query and optional explicit pick.
 * Exact typed names work without clicking the suggestion list.
 * A unique prefix is accepted on submit to reduce autocomplete friction.
 */
export function resolveLoginUser(directory, query, matched = null) {
  if (matched) return matched
  const rows = Array.isArray(directory) ? directory : []
  const q = normalizeLoginName(query)
  if (!q) return null
  const exact = rows.find((u) => normalizeLoginName(u?.name) === q)
  if (exact) return exact
  const prefix = rows.filter((u) => normalizeLoginName(u?.name).startsWith(q))
  return prefix.length === 1 ? prefix[0] : null
}
