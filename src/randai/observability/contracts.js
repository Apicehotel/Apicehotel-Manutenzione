export const TraceStatus = Object.freeze({ RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' })
export const SpanStatus = Object.freeze({ RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' })

export function validateTrace(trace) {
  if (!trace?.id || !trace?.name || !trace?.startedAt) throw new TypeError('Trace requires id, name and startedAt')
  if (!Object.values(TraceStatus).includes(trace.status)) throw new TypeError(`Invalid trace status: ${trace.status}`)
  if (!Array.isArray(trace.spans) || !Array.isArray(trace.events)) throw new TypeError('Trace requires spans and events arrays')
  const spanIds = new Set()
  for (const span of trace.spans) {
    if (!span?.id || !span?.name || !span?.startedAt) throw new TypeError('Span requires id, name and startedAt')
    if (!Object.values(SpanStatus).includes(span.status)) throw new TypeError(`Invalid span status: ${span.status}`)
    if (spanIds.has(span.id)) throw new TypeError(`Duplicate span id: ${span.id}`)
    if (span.status === SpanStatus.RUNNING && span.endedAt) throw new TypeError(`Running span cannot have endedAt: ${span.id}`)
    if (span.status !== SpanStatus.RUNNING && !span.endedAt) throw new TypeError(`Terminal span requires endedAt: ${span.id}`)
    spanIds.add(span.id)
  }
  for (const span of trace.spans) if (span.parentSpanId && !spanIds.has(span.parentSpanId)) throw new TypeError(`Unknown parent span: ${span.parentSpanId}`)
  for (const event of trace.events) {
    if (!event?.type || !event?.at) throw new TypeError('Trace event requires type and at')
    if (event.spanId && !spanIds.has(event.spanId)) throw new TypeError(`Trace event references unknown span: ${event.spanId}`)
  }
  if (trace.status === TraceStatus.RUNNING && trace.endedAt) throw new TypeError('Running trace cannot have endedAt')
  if (trace.status !== TraceStatus.RUNNING && !trace.endedAt) throw new TypeError('Terminal trace requires endedAt')
  return true
}
