export function createLogger({ sink = console, base = {} } = {}) {
  const emit = (level, event, data = {}) => {
    const entry = { ts: new Date().toISOString(), level, event, ...base, ...data }
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    sink?.[method]?.(entry)
    return entry
  }
  return {
    debug: (event, data) => emit('debug', event, data),
    info: (event, data) => emit('info', event, data),
    warn: (event, data) => emit('warn', event, data),
    error: (event, data) => emit('error', event, data),
    child: (extra = {}) => createLogger({ sink, base: { ...base, ...extra } }),
  }
}
