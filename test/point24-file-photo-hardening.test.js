import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sha256Hex, sniffImageType, sniffSpreadsheetType, validatePhotoBinary, validatePhotoDimensions, validateSpreadsheetFile, sanitizeStorageSegment } from '../src/file-hardening.js'

const photoStorage = fs.readFileSync('src/photo-storage.js','utf8')
const housekeeping = fs.readFileSync('src/housekeeping-v2.jsx','utf8')
const helpers = fs.readFileSync('src/randapp/helpers.js','utf8')
const issues = fs.readFileSync('src/issues-data.js','utf8')
const planned = fs.readFileSync('src/planned-data.js','utf8')

function namedBlob(bytes, name, type = '') {
  const blob = new Blob([Uint8Array.from(bytes)], { type })
  Object.defineProperty(blob, 'name', { value:name })
  return blob
}

const xlsMagic = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0,0,0,0]
const zipMagic = [0x50,0x4b,0x03,0x04,0,0,0,0]
const jpeg = [0xff,0xd8,0xff,0xe0,0,0,0,0]
const png = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]
const webp = [...Buffer.from('RIFF'),0,0,0,0,...Buffer.from('WEBP'),0,0]

test('SHA-256 fingerprints content independently from filename', async () => {
  const a = namedBlob(xlsMagic, 'report.xls')
  const b = namedBlob(xlsMagic, 'renamed.xls')
  assert.equal(await sha256Hex(a), await sha256Hex(b))
  assert.match(await sha256Hex(a), /^[0-9a-f]{64}$/)
})

test('spreadsheet intake checks binary magic, size and extension coherence', async () => {
  assert.equal(sniffSpreadsheetType(Uint8Array.from(xlsMagic)), 'xls')
  assert.equal(sniffSpreadsheetType(Uint8Array.from(zipMagic)), 'xlsx')
  const valid = await validateSpreadsheetFile(namedBlob(xlsMagic, 'housekeeping.xls'))
  assert.equal(valid.type, 'xls')
  await assert.rejects(() => validateSpreadsheetFile(namedBlob(xlsMagic, 'large.xls'), { maxBytes:4 }), /File troppo grande/)
  await assert.rejects(() => validateSpreadsheetFile(namedBlob([1,2,3,4], 'fake.xls')), /vero file XLS\/XLSX/)
  await assert.rejects(() => validateSpreadsheetFile(namedBlob(xlsMagic, 'fake.xlsx')), /non coerente/)
})

test('photo intake trusts binary content, not declared MIME or extension', async () => {
  assert.equal(sniffImageType(Uint8Array.from(jpeg)).mime, 'image/jpeg')
  assert.equal(sniffImageType(Uint8Array.from(png)).mime, 'image/png')
  assert.equal(sniffImageType(Uint8Array.from(webp)).mime, 'image/webp')
  const valid = await validatePhotoBinary(namedBlob(jpeg, 'camera.jpg', 'image/jpeg'))
  assert.equal(valid.extension, 'jpg')
  await assert.rejects(() => validatePhotoBinary(namedBlob(jpeg, 'large.jpg', 'image/jpeg'), { maxBytes:4 }), /Foto troppo grande/)
  await assert.rejects(() => validatePhotoBinary(namedBlob(jpeg, 'camera.png', 'image/jpeg')), /Estensione/)
  await assert.rejects(() => validatePhotoBinary(namedBlob(jpeg, 'camera.jpg', 'image/png')), /Tipo dichiarato/)
  await assert.rejects(() => validatePhotoBinary(namedBlob([1,2,3,4], 'camera.jpg', 'image/jpeg')), /Formato foto non riconosciuto/)
})

test('photo dimensions reject decompression-bomb class inputs', () => {
  assert.deepEqual(validatePhotoDimensions(4000,3000), {width:4000,height:3000,pixels:12_000_000})
  assert.throws(() => validatePhotoDimensions(20000,20000), /Risoluzione foto eccessiva/)
  assert.throws(() => validatePhotoDimensions(0,100), /Dimensioni foto non valide/)
})

test('storage paths are canonical and cross-hotel staged photos are rejected', () => {
  assert.equal(sanitizeStorageSegment('hotelgio'), 'hotelgio')
  assert.throws(() => sanitizeStorageSegment('../hotelgio'), /non valido/)
  assert.match(photoStorage, /materialized\.meta\?\.hotelId && materialized\.meta\.hotelId !== safeHotelId/)
  assert.match(photoStorage, /contentType: materialized\.verified\.mime/)
  assert.match(photoStorage, /sanitizeStorageSegment\(hotelId, 'hotelId'\)/)
  assert.match(issues, /stagePhotoOffline\(item\.photoData,\{hotelId:item\.hotelId/)
  assert.match(issues, /uploadPhotoValue\(item\.photoData,\{hotelId:item\.hotelId/)
  assert.match(planned, /stagePhotoOffline\(item\.photoAfter,\{hotelId:item\.hotelId/)
  assert.match(planned, /uploadPhotoValue\(item\.photoAfter,\{hotelId:item\.hotelId/)
})

test('housekeeping validates before SheetJS parse and keeps a per-hotel SHA-256 registry', () => {
  assert.match(housekeeping, /validateSpreadsheetFile\(file\)/)
  assert.match(housekeeping, /XLSX\.read\(verified\.bytes/)
  assert.match(housekeeping, /workbook\.SheetNames\?\.length/)
  assert.match(housekeeping, /imports:'&sha256,importedAt,kind'/)
  assert.match(housekeeping, /cache\.imports\.get\(parsed\.sourceSha256\)/)
  assert.match(housekeeping, /Importazione duplicata bloccata/)
  assert.match(housekeeping, /carica_camere_giorno/)
})

test('photo UI verifies source before decode/compression and storage re-verifies after compression', () => {
  assert.match(helpers, /validatePhotoBinary\(file/)
  assert.match(helpers, /validatePhotoDimensions/)
  assert.match(photoStorage, /verifiedPhotoBlob/)
  assert.match(photoStorage, /validatePhotoBinary\(blob/)
})
