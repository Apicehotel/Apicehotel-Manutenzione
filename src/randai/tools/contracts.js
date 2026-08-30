export const ToolStatus = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  RETRYABLE: 'RETRYABLE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
})

export const ToolRisk = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' })
export const ToolPermission = Object.freeze({ READ: 'READ', WRITE: 'WRITE', WRITE_PROTECTED: 'WRITE_PROTECTED', ADMIN: 'ADMIN' })

export function toolSuccess(data, metadata = {}) {
  return { status: ToolStatus.SUCCESS, data, error: null, metadata }
}

export function toolFailure(error, { status = ToolStatus.FAILED, retryable = false, metadata = {} } = {}) {
  return { status, data: null, error, retryable, metadata }
}
