import { redactDiagnosticText } from './diagnostics-client.js'

const env = import.meta.env || {}
const buildInfo = typeof __RANDAPP_BUILD__ !== 'undefined' ? __RANDAPP_BUILD__ : { sha: 'dev' }

let sentrySdk = null
let otelTracer = null
let initialized = false

function enabled(name) {
  return String(env[name] || '').toLowerCase() === 'true'
}

function safeSampleRate(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback
}

function sanitizeTelemetryValue(value, depth = 0) {
  if (depth > 4) return '[TRUNCATED]'
  if (typeof value === 'string') return redactDiagnosticText(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeTelemetryValue(item, depth + 1))
  if (typeof value === 'object') {
    const safe = {}
    for (const [key, item] of Object.entries(value).slice(0, 80)) {
      if (/^(authorization|apikey|api_key|token|access_token|refresh_token|password|passwd|pin|cookie|cookies)$/i.test(key)) {
        safe[key] = '[REDACTED]'
      } else {
        safe[key] = sanitizeTelemetryValue(item, depth + 1)
      }
    }
    return safe
  }
  return redactDiagnosticText(String(value))
}

export function externalTelemetryConfig() {
  return {
    sentry: {
      installed: true,
      configured: Boolean(env.VITE_SENTRY_DSN),
      enabled: enabled('VITE_SENTRY_ENABLED') && Boolean(env.VITE_SENTRY_DSN),
    },
    opentelemetry: {
      installed: true,
      configured: Boolean(env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT),
      enabled: enabled('VITE_OTEL_ENABLED') && Boolean(env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT),
    },
  }
}

export async function initExternalTelemetry() {
  if (initialized || typeof window === 'undefined') return externalTelemetryConfig()
  initialized = true
  const config = externalTelemetryConfig()

  if (config.sentry.enabled) {
    try {
      const Sentry = await import('@sentry/react')
      Sentry.init({
        dsn: env.VITE_SENTRY_DSN,
        environment: env.MODE || 'production',
        release: buildInfo?.sha || 'dev',
        sendDefaultPii: false,
        tracesSampleRate: safeSampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.05),
        beforeSend(event) {
          if (event?.user) event.user = undefined
          if (event?.request?.cookies) event.request.cookies = undefined
          if (event?.request?.headers) {
            const headers = { ...event.request.headers }
            delete headers.Authorization
            delete headers.authorization
            delete headers.apikey
            delete headers.cookie
            delete headers.Cookie
            event.request.headers = sanitizeTelemetryValue(headers)
          }
          if (event?.extra) event.extra = sanitizeTelemetryValue(event.extra)
          if (event?.contexts) event.contexts = sanitizeTelemetryValue(event.contexts)
          if (event?.breadcrumbs) event.breadcrumbs = sanitizeTelemetryValue(event.breadcrumbs)
          return event
        },
      })
      sentrySdk = Sentry
    } catch (error) {
      console.warn('Sentry non inizializzato', redactDiagnosticText(error?.message || error))
    }
  }

  if (config.opentelemetry.enabled) {
    try {
      const [{ WebTracerProvider, BatchSpanProcessor }, { OTLPTraceExporter }, { trace }] = await Promise.all([
        import('@opentelemetry/sdk-trace-web'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/api'),
      ])
      const exporter = new OTLPTraceExporter({ url: env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT })
      const provider = new WebTracerProvider({
        spanProcessors: [new BatchSpanProcessor(exporter, {
          maxQueueSize: 100,
          maxExportBatchSize: 10,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 10000,
        })],
      })
      provider.register()
      otelTracer = trace.getTracer('randapp-web', buildInfo?.sha || 'dev')
    } catch (error) {
      console.warn('OpenTelemetry non inizializzato', redactDiagnosticText(error?.message || error))
    }
  }

  return config
}

export function captureExternalError(error, context = {}) {
  if (!sentrySdk || !error) return false
  sentrySdk.captureException(error, { extra: sanitizeTelemetryValue(context) })
  return true
}

export function startExternalSpan(name, attributes = {}) {
  if (!otelTracer) return null
  const span = otelTracer.startSpan(redactDiagnosticText(String(name || 'operation')))
  for (const [key, value] of Object.entries(attributes || {})) {
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      const safeValue = typeof value === 'string' ? redactDiagnosticText(value) : value
      span.setAttribute(key, safeValue)
    }
  }
  return span
}
