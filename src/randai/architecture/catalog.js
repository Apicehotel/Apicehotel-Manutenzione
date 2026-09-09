export const RandArchitectureSourceRole = Object.freeze({
  SOURCE_ONLY: 'SOURCE_ONLY',
})

export const RandArchitectureSource = Object.freeze({
  id: 'system-design-notes',
  repository: 'https://github.com/liquidslr/system-design-notes',
  role: RandArchitectureSourceRole.SOURCE_ONLY,
  runtimeDependency: false,
  remoteExecution: false,
  copySourceText: false,
  extractionPolicy: 'PARAPHRASE_GENERAL_PATTERNS_ONLY',
  notes: 'Reference source for general system-design concepts. Do not import repository content as runtime knowledge or copy copyrighted book-derived notes.',
})

export const RandArchitectureDecision = Object.freeze({
  KEEP: 'KEEP',
  EVALUATE: 'EVALUATE',
  ADD: 'ADD',
  REJECT: 'REJECT',
})

export const RandArchitecturePattern = Object.freeze({
  IDEMPOTENCY: 'IDEMPOTENCY',
  OPTIMISTIC_CONCURRENCY: 'OPTIMISTIC_CONCURRENCY',
  ASYNC_QUEUE: 'ASYNC_QUEUE',
  TRANSACTIONAL_OUTBOX: 'TRANSACTIONAL_OUTBOX',
  RETRY_WITH_JITTER: 'RETRY_WITH_JITTER',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
  RATE_LIMITING: 'RATE_LIMITING',
  OBSERVABILITY: 'OBSERVABILITY',
  CACHE: 'CACHE',
  NOTIFICATION_FANOUT: 'NOTIFICATION_FANOUT',
  CHAT_DELIVERY: 'CHAT_DELIVERY',
})

const CATALOG = Object.freeze([
  Object.freeze({
    id: RandArchitecturePattern.IDEMPOTENCY,
    category: 'reliability',
    summary: 'Give repeatable operations a stable semantic identity so retries do not create duplicate effects.',
    useWhen: Object.freeze(['retry', 'offline replay', 'provider retry', 'double tap', 'at-least-once delivery']),
    avoidClaims: Object.freeze(['exactly-once delivery']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.OPTIMISTIC_CONCURRENCY,
    category: 'consistency',
    summary: 'Protect concurrent updates with version/timestamp compare-and-swap or equivalent server-side preconditions.',
    useWhen: Object.freeze(['multi-device update', 'concurrent edit', 'offline replay', 'reservation conflict']),
    avoidClaims: Object.freeze(['global locking without evidence']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.ASYNC_QUEUE,
    category: 'messaging',
    summary: 'Move slow or bursty non-blocking work behind a durable queue when synchronous completion is not required.',
    useWhen: Object.freeze(['notifications', 'media processing', 'provider calls', 'burst smoothing']),
    avoidClaims: Object.freeze(['queue implies exactly-once']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.TRANSACTIONAL_OUTBOX,
    category: 'reliability',
    summary: 'Persist the business change and the event-to-send in one atomic boundary, then deliver asynchronously.',
    useWhen: Object.freeze(['database change plus notification', 'event publication', 'external side effect']),
    avoidClaims: Object.freeze(['distributed transaction across providers']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.RETRY_WITH_JITTER,
    category: 'resilience',
    summary: 'Retry transient failures with bounded exponential backoff and jitter to avoid synchronized retry storms.',
    useWhen: Object.freeze(['network failure', 'provider 5xx', 'reconnect', 'worker retry']),
    avoidClaims: Object.freeze(['infinite retry']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.CIRCUIT_BREAKER,
    category: 'resilience',
    summary: 'Temporarily stop calls to a failing dependency after a threshold and probe recovery later.',
    useWhen: Object.freeze(['external provider', 'repeated failure', 'dependency outage']),
    avoidClaims: Object.freeze(['replace authorization or validation']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.RATE_LIMITING,
    category: 'protection',
    summary: 'Bound request or notification volume per actor, tenant, channel or operation class.',
    useWhen: Object.freeze(['abuse prevention', 'provider quota', 'notification fatigue', 'burst control']),
    avoidClaims: Object.freeze(['security boundary by itself']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.OBSERVABILITY,
    category: 'operations',
    summary: 'Measure health with structured logs, traces, metrics and explicit unknown/stale states.',
    useWhen: Object.freeze(['worker health', 'provider latency', 'queue backlog', 'release confidence']),
    avoidClaims: Object.freeze(['absence of error means healthy']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.CACHE,
    category: 'performance',
    summary: 'Cache derived/read-mostly data only when invalidation, staleness and authority are explicit.',
    useWhen: Object.freeze(['read latency', 'offline continuity', 'expensive derived data']),
    avoidClaims: Object.freeze(['cache as source of truth']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.NOTIFICATION_FANOUT,
    category: 'notifications',
    summary: 'Separate notification intent from channel delivery and keep channel retries/failures isolated.',
    useWhen: Object.freeze(['push', 'email', 'sms', 'in-app notification']),
    avoidClaims: Object.freeze(['one provider for all channels']),
  }),
  Object.freeze({
    id: RandArchitecturePattern.CHAT_DELIVERY,
    category: 'chat',
    summary: 'Treat message persistence, fan-out, offline delivery, ordering and notification as separate concerns.',
    useWhen: Object.freeze(['group chat', 'direct message', 'offline recipient', 'read receipt']),
    avoidClaims: Object.freeze(['transport acknowledgement equals durable read']),
  }),
])

export const RAND_ARCHITECTURE_CURRENT_EVIDENCE = Object.freeze({
  [RandArchitecturePattern.IDEMPOTENCY]: Object.freeze({
    status: 'IMPLEMENTED',
    evidence: Object.freeze(['docs/architecture/OFFLINE_RETRY_CONCURRENCY.md']),
    note: 'Stable operationId and mutation id already exist for governed retry/replay paths.',
  }),
  [RandArchitecturePattern.OPTIMISTIC_CONCURRENCY]: Object.freeze({
    status: 'IMPLEMENTED',
    evidence: Object.freeze(['docs/architecture/OFFLINE_RETRY_CONCURRENCY.md']),
    note: 'CAS via updated_at and server-side guarded delete are already documented.',
  }),
  [RandArchitecturePattern.RETRY_WITH_JITTER]: Object.freeze({
    status: 'IMPLEMENTED',
    evidence: Object.freeze(['docs/architecture/OFFLINE_RETRY_CONCURRENCY.md']),
    note: 'Jittered retry is already part of the offline reliability design.',
  }),
  [RandArchitecturePattern.OBSERVABILITY]: Object.freeze({
    status: 'IMPLEMENTED',
    evidence: Object.freeze(['src/randai/core/ai-observability.js', 'src/randai/core/health-snapshot.js']),
    note: 'RandCore/OpenTelemetry remain canonical observability owners.',
  }),
  [RandArchitecturePattern.CACHE]: Object.freeze({
    status: 'IMPLEMENTED',
    evidence: Object.freeze(['src/offline-store.js']),
    note: 'Offline/cache state is non-authoritative and remains bounded by server validation.',
  }),
  [RandArchitecturePattern.ASYNC_QUEUE]: Object.freeze({
    status: 'EVALUATE_PER_DOMAIN',
    evidence: Object.freeze(['src/randai/core/durable-runtime.js']),
    note: 'Do not add a second queue/runtime where existing durable or outbox mechanisms are sufficient.',
  }),
  [RandArchitecturePattern.TRANSACTIONAL_OUTBOX]: Object.freeze({
    status: 'EVALUATE_PER_DOMAIN',
    evidence: Object.freeze([]),
    note: 'Use only where a database mutation and external event must stay atomic.',
  }),
  [RandArchitecturePattern.CIRCUIT_BREAKER]: Object.freeze({
    status: 'EVALUATE_PER_PROVIDER',
    evidence: Object.freeze([]),
    note: 'Add only for unstable external dependencies after failure evidence and thresholds are defined.',
  }),
  [RandArchitecturePattern.RATE_LIMITING]: Object.freeze({
    status: 'EVALUATE_PER_BOUNDARY',
    evidence: Object.freeze([]),
    note: 'Apply to abuse/quota/noise boundaries, not as a substitute for authorization.',
  }),
  [RandArchitecturePattern.NOTIFICATION_FANOUT]: Object.freeze({
    status: 'EVALUATE_PER_CHANNEL',
    evidence: Object.freeze([]),
    note: 'Keep intent, preferences and delivery-channel failure domains separate.',
  }),
  [RandArchitecturePattern.CHAT_DELIVERY]: Object.freeze({
    status: 'EVALUATE_FOR_RANDCHAT',
    evidence: Object.freeze(['docs/architecture/RANDCHAT.md']),
    note: 'Use as guidance for RandChat evolution without creating a second messaging authority.',
  }),
})

export function listRandArchitecturePatterns() {
  return CATALOG.map((item) => ({ ...item, useWhen: [...item.useWhen], avoidClaims: [...item.avoidClaims] }))
}

export function getRandArchitecturePattern(id) {
  return CATALOG.find((item) => item.id === id) || null
}

export function assertRandArchitectureCatalog() {
  if (RandArchitectureSource.runtimeDependency || RandArchitectureSource.remoteExecution || RandArchitectureSource.copySourceText) {
    throw new TypeError('RandArchitecture external source must remain reference-only')
  }
  const seen = new Set()
  for (const item of CATALOG) {
    if (!item.id || !item.category || !item.summary) throw new TypeError('Invalid RandArchitecture pattern')
    if (seen.has(item.id)) throw new TypeError(`Duplicate RandArchitecture pattern: ${item.id}`)
    seen.add(item.id)
  }
  return true
}
