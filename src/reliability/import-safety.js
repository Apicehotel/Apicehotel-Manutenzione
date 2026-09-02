const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

export const ImportRowStatus = Object.freeze({
  READY: 'READY',
  REJECTED: 'REJECTED',
})

export function normalizeImportRows(rows, normalizeRow = (row) => row) {
  if (!Array.isArray(rows)) throw new TypeError('import rows must be an array')
  if (typeof normalizeRow !== 'function') throw new TypeError('normalizeRow must be a function')
  return rows.map((row, index) => freeze({ index, value: normalizeRow(row, index) }))
}

export async function stageImport({
  batchId,
  hotelId,
  rows,
  normalizeRow = (row) => row,
  validateRow,
  rowHotelId = (row) => row?.hotelId ?? row?.hotel_id,
  dedupeKey = null,
} = {}) {
  if (!text(batchId)) throw new TypeError('batchId is required')
  if (!text(hotelId)) throw new TypeError('hotelId is required')
  if (typeof validateRow !== 'function') throw new TypeError('validateRow is required')
  if (dedupeKey !== null && typeof dedupeKey !== 'function') throw new TypeError('dedupeKey must be a function')

  const normalized = normalizeImportRows(rows, normalizeRow)
  const seen = new Set()
  const staged = []

  for (const item of normalized) {
    const errors = []
    const scopedHotelId = text(rowHotelId(item.value))
    if (!scopedHotelId) errors.push({ code: 'MISSING_HOTEL_SCOPE' })
    else if (scopedHotelId !== text(hotelId)) errors.push({ code: 'HOTEL_MISMATCH', actual: scopedHotelId })

    const validation = await validateRow(item.value, item.index)
    if (validation === false) errors.push({ code: 'VALIDATION_FAILED' })
    else if (Array.isArray(validation)) errors.push(...validation)
    else if (validation?.ok === false) errors.push(...(validation.errors || [{ code: 'VALIDATION_FAILED' }]))

    if (dedupeKey) {
      const key = text(dedupeKey(item.value, item.index))
      if (!key) errors.push({ code: 'MISSING_DEDUPE_KEY' })
      else if (seen.has(key)) errors.push({ code: 'DUPLICATE_ROW', key })
      else seen.add(key)
    }

    staged.push(freeze({
      index: item.index,
      value: item.value,
      status: errors.length ? ImportRowStatus.REJECTED : ImportRowStatus.READY,
      errors: freeze(errors),
    }))
  }

  const ready = staged.filter((row) => row.status === ImportRowStatus.READY)
  const rejected = staged.filter((row) => row.status === ImportRowStatus.REJECTED)
  return freeze({
    batchId: text(batchId),
    hotelId: text(hotelId),
    total: staged.length,
    readyCount: ready.length,
    rejectedCount: rejected.length,
    canCommit: staged.length > 0 && rejected.length === 0,
    rows: freeze(staged),
  })
}

export async function commitStagedImport({ staged, writeRows, readBack, verify, audit } = {}) {
  if (!staged || typeof staged !== 'object') throw new TypeError('staged import is required')
  if (!staged.canCommit) throw new Error('IMPORT_STAGE_NOT_COMMITTABLE')
  for (const [name, fn] of Object.entries({ writeRows, readBack, verify, audit })) {
    if (typeof fn !== 'function') throw new TypeError(`${name} function is required`)
  }
  const rows = staged.rows.map((row) => row.value)
  const writeResult = await writeRows(rows, staged)
  const persisted = await readBack(staged)
  const verified = await verify(persisted, rows, staged)
  if (verified !== true) throw new Error('IMPORT_VERIFY_FAILED')
  const receipt = freeze({
    batchId: staged.batchId,
    hotelId: staged.hotelId,
    rowCount: rows.length,
    verified: true,
    writeResult,
  })
  await audit(receipt)
  return freeze({ ok: true, receipt, persisted })
}
