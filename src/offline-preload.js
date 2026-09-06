import { canUser } from './permissions.js'
import { fetchDirectory } from './users-data.js'

const PRELOAD_TTL_MS = 10 * 60 * 1000
const warmedAt = new Map()
const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine

const sessionUserId = (session) => session?.userId || session?.authUserId || session?.user?.auth_user_id || session?.user?.id || null
const sameUser = (user, id) => Boolean(id) && [user?.auth_user_id, user?.id, user?.legacy_id].some((value) => value === id)

export function offlinePreloadCapabilities(user) {
  return {
    issues: canUser(user, 'issues', 'view'),
    planned: canUser(user, 'interventions', 'view') || canUser(user, 'planning_work', 'view'),
    bookings: canUser(user, 'planning_sale', 'view'),
    urgents: canUser(user, 'urgent', 'view'),
    supplies: canUser(user, 'supplies', 'view'),
  }
}

function preloadKey(session) {
  return `${session?.hotelId || 'none'}:${sessionUserId(session) || 'none'}`
}

export async function warmOfflineForSession(session, { force = false, now = Date.now() } = {}) {
  if (!session?.hotelId || !sessionUserId(session) || !onlineNow()) return { warmed: false, reason: 'offline-or-session-missing' }

  const key = preloadKey(session)
  const previous = warmedAt.get(key) || 0
  if (!force && now - previous < PRELOAD_TTL_MS) return { warmed: false, reason: 'fresh' }

  const { users = [] } = await fetchDirectory(session.hotelId)
  const user = users.find((candidate) => sameUser(candidate, sessionUserId(session))) || null
  if (!user) return { warmed: false, reason: 'unauthorized' }

  const capabilities = offlinePreloadCapabilities(user)
  const tasks = []
  if (capabilities.issues) tasks.push(['issues', () => import('./issues-data.js').then(({ fetchIssues }) => fetchIssues(session.hotelId))])
  if (capabilities.planned) tasks.push(['planned', () => import('./planned-data.js').then(({ fetchPlanned }) => fetchPlanned(session.hotelId))])
  if (capabilities.bookings) tasks.push(['bookings', () => import('./sale-data.js').then(({ fetchBookings }) => fetchBookings(session.hotelId))])
  if (capabilities.urgents) tasks.push(['urgents', () => import('./urgents-data.js').then(({ fetchUrgents }) => fetchUrgents(session.hotelId))])
  if (capabilities.supplies) {
    tasks.push(['supplies', async () => {
      const [{ fetchSupplyProducts, fetchSupplyRequests }, { fetchOperationalFloorContexts }] = await Promise.all([
        import('./supply-data.js'),
        import('./operational-context.js'),
      ])
      await Promise.all([
        fetchSupplyProducts(session.hotelId),
        fetchSupplyRequests(session.hotelId),
        fetchOperationalFloorContexts(session.hotelId),
      ])
    }])
  }

  const results = await Promise.allSettled(tasks.map(([, run]) => run()))
  const failed = results.flatMap((result, index) => result.status === 'rejected' ? [tasks[index][0]] : [])
  const succeeded = results.length - failed.length
  if (!tasks.length || succeeded > 0) warmedAt.set(key, now)

  return {
    warmed: succeeded > 0 || tasks.length === 0,
    modules: tasks.map(([name]) => name),
    failed,
  }
}
