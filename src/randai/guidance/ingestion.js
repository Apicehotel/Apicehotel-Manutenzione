const clean = (value) => String(value ?? '').trim()

export function normalizeKnowledgeSource(input = {}) {
  const hotelId = clean(input.hotelId || input.hotel_id)
  const title = clean(input.title)
  if (!hotelId || !title) throw new TypeError('RandGuide source requires hotelId and title')
  const sourceType = clean(input.sourceType || input.source_type) || 'procedura_interna'
  const externalUrl = clean(input.externalUrl || input.external_url) || null
  const storagePath = clean(input.storagePath || input.storage_path) || null
  if (externalUrl && storagePath) throw new TypeError('RandGuide source must use either externalUrl or storagePath, not both')
  const mediaKind = clean(input.mediaKind || input.media_kind) || 'document'
  const provenance = Object.freeze({
    sourceType,
    sourceLabel:clean(input.sourceLabel || input.source_label) || title,
    importedAt:input.importedAt || input.imported_at || new Date().toISOString(),
    verifiedBy:clean(input.verifiedBy || input.verified_by) || null,
    confidence:Math.max(0, Math.min(100, Number(input.confidence ?? 100))),
  })
  return Object.freeze({
    id:clean(input.id) || null, hotelId, title, sourceType, mediaKind,
    externalUrl, storagePath, procedureId:clean(input.procedureId || input.procedure_id) || null,
    equipmentId:clean(input.equipmentId || input.equipment_id) || null,
    status:clean(input.status) || 'draft', provenance,
  })
}

export function sourceDedupeKey(input) {
  const source = normalizeKnowledgeSource(input)
  return [source.hotelId, source.sourceType, source.externalUrl || source.storagePath || source.title.toLowerCase(), source.procedureId || '', source.equipmentId || ''].join('|')
}

export function dedupeKnowledgeSources(items = []) {
  const seen = new Set(), accepted = [], duplicates = []
  for (const item of items) {
    const key = sourceDedupeKey(item)
    if (seen.has(key)) duplicates.push(item)
    else { seen.add(key); accepted.push(normalizeKnowledgeSource(item)) }
  }
  return Object.freeze({ accepted:Object.freeze(accepted), duplicates:Object.freeze(duplicates) })
}
