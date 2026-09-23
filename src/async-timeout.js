/**
 * Bound an async operation so flaky mobile networks cannot leave the UI
 * stuck on a spinner forever. Rejection uses a stable Error message for tests.
 */
export function withTimeout(promise, timeoutMs = 12000, label = 'Timeout') {
  const ms = Math.max(1, Number(timeoutMs) || 12000)
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms)
    timer?.unref?.()
  })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Fetch wrapper that aborts hung REST/storage calls. Used as Supabase global.fetch
 * so list/bootstrap queries cannot spin forever on flaky mobile networks.
 */
export function createTimedFetch(timeoutMs = 20000) {
  const ms = Math.max(1000, Number(timeoutMs) || 20000)
  return async function timedFetch(input, init = {}) {
    const controller = new AbortController()
    const parent = init?.signal
    const forwardAbort = () => {
      try { controller.abort(parent?.reason) } catch { controller.abort() }
    }
    if (parent) {
      if (parent.aborted) forwardAbort()
      else parent.addEventListener('abort', forwardAbort, { once: true })
    }
    const timer = setTimeout(() => {
      try { controller.abort(new DOMException(`Network timeout after ${ms}ms`, 'AbortError')) }
      catch { controller.abort() }
    }, ms)
    timer?.unref?.()
    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      if (parent) parent.removeEventListener('abort', forwardAbort)
    }
  }
}
