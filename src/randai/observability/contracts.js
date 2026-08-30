export const TraceStatus = Object.freeze({ RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' })
export const SpanStatus = Object.freeze({ RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' })

export function validateTrace(trace) {
  if (!trace?.id || !trace?.name || !trace?.startedAt) throw new TypeError('Trace requires id, name and startedAt')
  if (!Array.isArray(trace.spans) || !Array.isArray(trace.events)) throw new TypeError('Trace requires spans and events arrays')
  const spanIds = new Set()
  for (const span of trace.spans) {
    if (!span?.id || !span?.name || !span?.startedAt) throw new TypeError('Span requires id, name and startedAt')
    if (spanIds.has(span.id)) throw new TypeError(`Duplicate span id: ${span.id}`)
    spanIds.add(span.id)
  }
  for (const span of trace.spans) if (span.parentSpanId && !spanIds.has(span.parentSpanId)) throw new TypeError(`Unknown parent span: ${span.parentSpanId}`)
  return true
}
