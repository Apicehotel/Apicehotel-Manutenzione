export const RandAIErrorCode = Object.freeze({
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TOOL_ERROR: 'TOOL_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  MODEL_ERROR: 'MODEL_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMIT: 'RATE_LIMIT',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_UNAVAILABLE: 'TOOL_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

export class RandAIError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'RandAIError'
    this.code = code || RandAIErrorCode.UNKNOWN_ERROR
    this.retryable = Boolean(options.retryable)
    this.details = options.details ?? null
  }
}

export function normalizeRandAIError(error, fallbackCode = RandAIErrorCode.UNKNOWN_ERROR) {
  if (error instanceof RandAIError) return error
  return new RandAIError(fallbackCode, error?.message || String(error || 'Unknown error'), { cause: error })
}
