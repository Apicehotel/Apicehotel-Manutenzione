import { QueryClient } from '@tanstack/react-query'

const DEFAULT_STALE_TIME_MS = 30_000
const DEFAULT_GC_TIME_MS = 10 * 60_000

// Canonical server-state cache for RandApp.
// Dexie remains the durable offline owner; TanStack Query owns in-memory
// server-state freshness, retry and invalidation only.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      gcTime: DEFAULT_GC_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false
        const status = Number(error?.status ?? error?.statusCode ?? error?.code)
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export function clearServerStateCache() {
  queryClient.clear()
}
