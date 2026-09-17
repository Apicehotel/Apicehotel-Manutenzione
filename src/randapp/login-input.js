export function normalizeLoginNick(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('it')
}

export function resolveLoginUser(value, directory = []) {
  const query = normalizeLoginNick(value)
  if (!query) return null
  return directory.find((user) => normalizeLoginNick(user?.name) === query) || null
}

export function sanitizeLoginPin(value, maxDigits = 4) {
  const limit = Number.isInteger(maxDigits) && maxDigits >= 0 ? maxDigits : 4
  return String(value ?? '').normalize('NFKC').replace(/\D/g, '').slice(0, limit)
}
