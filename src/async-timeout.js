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
