const text = (value) => String(value ?? '').trim()
const frozen = (value) => Object.freeze(value)

export const ValidationCode = frozen({
  REQUIRED: 'REQUIRED',
  INVALID_VALUE: 'INVALID_VALUE',
  INVALID_NUMBER: 'INVALID_NUMBER',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  TOO_LONG: 'TOO_LONG',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
})

export function validationIssue(path, code, message, meta = null) {
  return frozen({ path, code, message, meta })
}

export function validationResult(issues = [], value = null) {
  const list = frozen([...issues])
  return frozen({ ok: list.length === 0, issues: list, value })
}

export function required(value, path, message = `${path} è obbligatorio`) {
  return text(value) ? [] : [validationIssue(path, ValidationCode.REQUIRED, message)]
}

export function oneOf(value, allowed, path, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return []
  return allowed.includes(value) ? [] : [validationIssue(path, ValidationCode.INVALID_VALUE, `${path} non valido`, { allowed })]
}

export function maxLength(value, max, path, { optional = true } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return []
  return text(value).length <= max ? [] : [validationIssue(path, ValidationCode.TOO_LONG, `${path} supera ${max} caratteri`, { max })]
}

export function finiteNumber(value, path, { min = null, max = null, optional = false, integer = false, nonZero = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return []
  const number = Number(value)
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || (nonZero && number === 0)) {
    return [validationIssue(path, ValidationCode.INVALID_NUMBER, `${path} deve essere un numero valido`)]
  }
  if ((min !== null && number < min) || (max !== null && number > max)) {
    return [validationIssue(path, ValidationCode.OUT_OF_RANGE, `${path} fuori intervallo`, { min, max })]
  }
  return []
}

export function isoDate(value, path, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return []
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? [] : [validationIssue(path, ValidationCode.INVALID_DATE, `${path} non è una data valida`)]
}

export function dateRange(from, to, fromPath = 'dateFrom', toPath = 'dateTo') {
  const issues = [...isoDate(from, fromPath), ...isoDate(to, toPath)]
  if (issues.length) return issues
  return Date.parse(to) >= Date.parse(from)
    ? []
    : [validationIssue(toPath, ValidationCode.INVALID_DATE_RANGE, `${toPath} non può precedere ${fromPath}`)]
}

export function transition(current, next, transitions, path = 'status', { allowSame = true } = {}) {
  if (!next || !current) return []
  if (allowSame && current === next) return []
  const allowed = transitions[current] || []
  return allowed.includes(next)
    ? []
    : [validationIssue(path, ValidationCode.INVALID_STATE_TRANSITION, `Transizione ${current} → ${next} non consentita`, { current, next, allowed })]
}

export function combineValidation(...parts) {
  return validationResult(parts.flat().filter(Boolean))
}

export class OperationValidationError extends Error {
  constructor(result, message = 'Operazione non valida') {
    super(message)
    this.name = 'OperationValidationError'
    this.code = 'OPERATION_VALIDATION_FAILED'
    this.issues = result?.issues || []
  }
}

export function assertValid(result, message) {
  if (result?.ok) return result.value
  throw new OperationValidationError(result, message)
}
