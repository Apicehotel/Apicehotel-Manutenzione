import { supabase } from './supabase.js'
import { assertValid } from './reliability/validation-engine.js'
import { validateInventoryItem, validateStockAdjustment } from './reliability/domain-validation.js'

const PHOTO_BUCKET = 'maintenance-photos'
const clean = (value) => String(value ?? '').trim()
const cleanList = (value) => Array.from(new Set((Array.isArray(value) ? value : []).map(clean).filter(Boolean)))

function normalizeItem(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    name: row.name,
    category: row.category || 'Da classificare',
    categoryId: row.category_id || null,
    itemType: row.item_type || 'consumabile',
    parentItemId: row.parent_item_id || null,
    catalogKey: row.catalog_key || null,
    scanCode: row.scan_code || '',
    variantLabel: row.variant_label || '',
    unit: row.unit || 'pz',
    location: row.location || '',
    defaultLocationId: row.default_location_id || null,
    sku: row.sku || '',
    barcode: row.barcode || '',
    manufacturer: row.manufacturer || '',
    model: row.model || '',
    attributes: row.attributes && typeof row.attributes === 'object' ? row.attributes : {},
    tags: Array.isArray(row.tags) ? row.tags : [],
    synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
    quantity: Number(row.quantity || 0),
    minQuantity: Number(row.min_quantity || 0),
    idealQuantity: Number(row.ideal_quantity || 0),
    reorderQuantity: Number(row.reorder_quantity || 0),
    notes: row.notes || '',
    photoPath: row.photo_path || '',
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeMovement(row) {
  return {
    id: row.id, hotelId: row.hotel_id, itemId: row.item_id, delta: Number(row.delta || 0), before: Number(row.quantity_before || 0), after: Number(row.quantity_after || 0),
    movementType: row.movement_type || (Number(row.delta || 0) > 0 ? 'carico' : 'scarico'), locationId: row.location_id || null, reasonCode: row.reason_code || '',
    referenceType: row.reference_type || '', referenceId: row.reference_id || '', correlationId: row.correlation_id || '', metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    note: row.note || '', createdBy: row.created_by || null, createdAt: row.created_at,
  }
}

function normalizeCategory(row) {
  return { id: row.id, hotelId: row.hotel_id, parentId: row.parent_id || null, name: row.name, code: row.code, description: row.description || '', icon: row.icon || '', color: row.color || '', attributeSchema: Array.isArray(row.attribute_schema) ? row.attribute_schema : [], synonyms: Array.isArray(row.synonyms) ? row.synonyms : [], faultTerms: Array.isArray(row.fault_terms) ? row.fault_terms : [], defaultAction: row.default_action || '', active: row.active !== false, sortOrder: Number(row.sort_order || 0) }
}

function normalizeLocation(row) {
  return { id: row.id, hotelId: row.hotel_id, parentId: row.parent_id || null, name: row.name, code: row.code, scanCode: row.scan_code || '', kind: row.kind || 'area', notes: row.notes || '', active: row.active !== false, sortOrder: Number(row.sort_order || 0) }
}

export async function fetchInventoryItems(hotelId) { if (!supabase) return []; const { data, error } = await supabase.from('inventory_items').select('*').eq('hotel_id', hotelId).eq('active', true).order('category').order('name'); if (error) throw error; return (data || []).map(normalizeItem) }
export async function fetchInventoryCategories(hotelId, { includeInactive = false } = {}) { if (!supabase) return []; let query = supabase.from('inventory_categories').select('*').eq('hotel_id', hotelId).order('sort_order').order('name'); if (!includeInactive) query = query.eq('active', true); const { data, error } = await query; if (error) throw error; return (data || []).map(normalizeCategory) }
export async function createInventoryCategory(hotelId, draft = {}) { if (!supabase) throw new Error('Supabase non disponibile'); const name = clean(draft.name); if (!hotelId || !name) throw new TypeError('hotelId e nome categoria sono obbligatori'); const code = (clean(draft.code) || name).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48); const payload = { hotel_id: hotelId, parent_id: draft.parentId || null, name, code, description: clean(draft.description) || null, attribute_schema: Array.isArray(draft.attributeSchema) ? draft.attributeSchema : [], synonyms: cleanList(draft.synonyms), fault_terms: cleanList(draft.faultTerms), default_action: clean(draft.defaultAction) || null, sort_order: Number(draft.sortOrder || 0) }; const { data, error } = await supabase.from('inventory_categories').insert(payload).select('*').single(); if (error) throw error; return normalizeCategory(data) }
export async function updateInventoryCategory(id, hotelId, changes = {}) { if (!supabase) throw new Error('Supabase non disponibile'); const payload = {}; if ('parentId' in changes) payload.parent_id = changes.parentId || null; if ('name' in changes) payload.name = clean(changes.name); if ('description' in changes) payload.description = clean(changes.description) || null; if ('attributeSchema' in changes) payload.attribute_schema = Array.isArray(changes.attributeSchema) ? changes.attributeSchema : []; if ('synonyms' in changes) payload.synonyms = cleanList(changes.synonyms); if ('faultTerms' in changes) payload.fault_terms = cleanList(changes.faultTerms); if ('defaultAction' in changes) payload.default_action = clean(changes.defaultAction) || null; if ('sortOrder' in changes) payload.sort_order = Number(changes.sortOrder || 0); if ('active' in changes) payload.active = Boolean(changes.active); const { data, error } = await supabase.from('inventory_categories').update(payload).eq('id', id).eq('hotel_id', hotelId).select('*').single(); if (error) throw error; return normalizeCategory(data) }
export async function fetchInventoryLocations(hotelId, { includeInactive = false } = {}) { if (!supabase) return []; let query = supabase.from('inventory_locations').select('*').eq('hotel_id', hotelId).order('sort_order').order('name'); if (!includeInactive) query = query.eq('active', true); const { data, error } = await query; if (error) throw error; return (data || []).map(normalizeLocation) }
export async function createInventoryLocation(hotelId, draft = {}) { if (!supabase) throw new Error('Supabase non disponibile'); const name = clean(draft.name); if (!hotelId || !name) throw new TypeError('hotelId e nome ubicazione sono obbligatori'); const code = (clean(draft.code) || name).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48); const { data, error } = await supabase.from('inventory_locations').insert({ hotel_id: hotelId, parent_id: draft.parentId || null, name, code, kind: clean(draft.kind) || 'area', notes: clean(draft.notes) || null, sort_order: Number(draft.sortOrder || 0) }).select('*').single(); if (error) throw error; return normalizeLocation(data) }

export async function uploadInventoryPhoto(hotelId, itemId, file) { if (!supabase || !file) return ''; if (!hotelId || !itemId) throw new TypeError('hotelId e itemId sono obbligatori'); const type = file.type || 'image/jpeg'; if (!type.startsWith('image/')) throw new Error('Seleziona un file immagine'); if (file.size > 10 * 1024 * 1024) throw new Error('La foto supera 10 MB'); const ext = (file.name?.split('.').pop() || type.split('/').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'; const path = `${hotelId}/inventory/${itemId}/${Date.now()}.${ext}`; const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: type, upsert: false }); if (error) throw error; return path }
export async function getInventoryPhotoUrl(photoPath) { if (!supabase || !photoPath) return ''; const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photoPath, 60 * 60); if (error) throw error; return data?.signedUrl || '' }

export async function createInventoryItem(hotelId, draft = {}) {
  if (!supabase) throw new Error('Supabase non disponibile')
  assertValid(validateInventoryItem(hotelId, draft), 'Articolo magazzino non valido')
  const initialQuantity = Number(draft.quantity || 0)
  const payload = { hotel_id: hotelId, name: clean(draft.name), category: clean(draft.category) || 'Da classificare', category_id: draft.categoryId || null, item_type: clean(draft.itemType) || 'consumabile', parent_item_id: draft.parentItemId || null, variant_label: clean(draft.variantLabel) || null, unit: clean(draft.unit) || 'pz', location: clean(draft.location) || null, default_location_id: draft.defaultLocationId || null, sku: clean(draft.sku) || null, barcode: clean(draft.barcode) || null, manufacturer: clean(draft.manufacturer) || null, model: clean(draft.model) || null, attributes: draft.attributes && typeof draft.attributes === 'object' ? draft.attributes : {}, tags: cleanList(draft.tags), synonyms: cleanList(draft.synonyms), min_quantity: Number(draft.minQuantity || 0), ideal_quantity: Number(draft.idealQuantity || 0), reorder_quantity: Number(draft.reorderQuantity || 0), notes: clean(draft.notes) || null }
  const { data, error } = await supabase.from('inventory_items').insert(payload).select('*').single(); if (error) throw error
  try { if (draft.photo) { const photoPath = await uploadInventoryPhoto(hotelId, data.id, draft.photo); const { data: updated, error: updateError } = await supabase.from('inventory_items').update({ photo_path: photoPath }).eq('id', data.id).eq('hotel_id', hotelId).select('*').single(); if (updateError) throw updateError; Object.assign(data, updated) } if (initialQuantity > 0) return adjustInventoryStock(data.id, initialQuantity, 'Giacenza iniziale', { movementType: 'inventario', reasonCode: 'initial_stock' }); return normalizeItem(data) } catch (err) { await supabase.from('inventory_items').delete().eq('id', data.id).eq('hotel_id', hotelId); throw err }
}

export async function updateInventoryItem(id, hotelId, changes = {}) {
  if (!supabase) throw new Error('Supabase non disponibile'); if (!id) throw new TypeError('id è obbligatorio'); assertValid(validateInventoryItem(hotelId, changes, { partial: true }), 'Aggiornamento articolo non valido')
  const payload = {}; if ('name' in changes) payload.name = clean(changes.name); if ('category' in changes) payload.category = clean(changes.category) || 'Da classificare'; if ('categoryId' in changes) payload.category_id = changes.categoryId || null; if ('itemType' in changes) payload.item_type = clean(changes.itemType) || 'consumabile'; if ('parentItemId' in changes) payload.parent_item_id = changes.parentItemId || null; if ('variantLabel' in changes) payload.variant_label = clean(changes.variantLabel) || null; if ('unit' in changes) payload.unit = clean(changes.unit) || 'pz'; if ('location' in changes) payload.location = clean(changes.location) || null; if ('defaultLocationId' in changes) payload.default_location_id = changes.defaultLocationId || null; if ('sku' in changes) payload.sku = clean(changes.sku) || null; if ('barcode' in changes) payload.barcode = clean(changes.barcode) || null; if ('manufacturer' in changes) payload.manufacturer = clean(changes.manufacturer) || null; if ('model' in changes) payload.model = clean(changes.model) || null; if ('attributes' in changes) payload.attributes = changes.attributes && typeof changes.attributes === 'object' ? changes.attributes : {}; if ('tags' in changes) payload.tags = cleanList(changes.tags); if ('synonyms' in changes) payload.synonyms = cleanList(changes.synonyms); if ('minQuantity' in changes) payload.min_quantity = Number(changes.minQuantity || 0); if ('idealQuantity' in changes) payload.ideal_quantity = Number(changes.idealQuantity || 0); if ('reorderQuantity' in changes) payload.reorder_quantity = Number(changes.reorderQuantity || 0); if ('notes' in changes) payload.notes = clean(changes.notes) || null; if ('active' in changes) payload.active = Boolean(changes.active)
  const { data, error } = await supabase.from('inventory_items').update(payload).eq('id', id).eq('hotel_id', hotelId).select('*').single(); if (error) throw error; return normalizeItem(data)
}

export async function adjustInventoryStock(itemId, delta, note = '', options = {}) { if (!supabase) throw new Error('Supabase non disponibile'); if (!itemId) throw new TypeError('itemId è obbligatorio'); assertValid(validateStockAdjustment(delta, options.movementType), 'Movimento magazzino non valido'); const { data, error } = await supabase.rpc('inventory_adjust_stock_v2', { p_item_id: itemId, p_delta: Number(delta), p_movement_type: clean(options.movementType) || null, p_note: clean(note) || null, p_location_id: options.locationId || null, p_reason_code: clean(options.reasonCode) || null, p_reference_type: clean(options.referenceType) || null, p_reference_id: clean(options.referenceId) || null, p_metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {} }); if (error) throw error; return normalizeItem(data) }
export async function fetchInventoryMovements(itemId) { if (!supabase) return []; const { data, error } = await supabase.from('inventory_movements').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(100); if (error) throw error; return (data || []).map(normalizeMovement) }
export async function fetchInventoryReorderStatus(hotelId) { if (!supabase) return []; const { data, error } = await supabase.from('inventory_reorder_status').select('*').eq('hotel_id', hotelId).neq('stock_status', 'ok').order('stock_status'); if (error) throw error; return data || [] }
export function subscribeInventory(hotelId, onChange) { if (!supabase) return () => {}; const channel = supabase.channel(`inventory-${hotelId}-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `hotel_id=eq.${hotelId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements', filter: `hotel_id=eq.${hotelId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_categories', filter: `hotel_id=eq.${hotelId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_locations', filter: `hotel_id=eq.${hotelId}` }, onChange).subscribe(); return () => { supabase.removeChannel(channel) } }
