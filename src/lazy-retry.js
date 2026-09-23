import { lazy } from 'react'
import { isDeploymentAssetError } from './deployment-recovery.js'

const wait = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms)
  timer?.unref?.()
})

/**
 * Soft-retry dynamic imports before surfacing a Suspense/ErrorBoundary failure.
 * React.lazy still caches a final rejection; recoverable module errors must then
 * fall through to deployment recovery or a full reload from the error UI.
 */
export function lazyWithRetry(factory, { retries = 2, delayMs = 450 } = {}) {
  return lazy(async () => {
    let lastError = null
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await factory()
      } catch (error) {
        lastError = error
        if (attempt === retries) break
        // Only burn retries on transient/stale asset failures; render bugs should fail fast.
        if (!isDeploymentAssetError(error) && !/failed to fetch|network|load failed|timeout/i.test(String(error?.message || error || ''))) {
          break
        }
        await wait(delayMs * (attempt + 1))
      }
    }
    throw lastError
  })
}
