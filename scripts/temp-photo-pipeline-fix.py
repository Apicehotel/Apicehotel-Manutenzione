from pathlib import Path

# helpers.js: refuse empty/invalid photos before they enter the pipeline
p = Path('src/randapp/helpers.js')
s = p.read_text()
old = """export const readPhotoAsDataUrl = (file) => new Promise((resolve) => {\n  if (!file) return resolve(null)\n  const reader = new FileReader()\n  reader.onload = () => resolve(reader.result)\n  reader.onerror = () => resolve(null)\n  reader.readAsDataURL(file)\n})\n"""
new = """export const readPhotoAsDataUrl = (file) => new Promise((resolve) => {\n  if (!file || !file.size) return resolve(null)\n  const reader = new FileReader()\n  reader.onload = () => {\n    const result = typeof reader.result === 'string' ? reader.result : ''\n    const comma = result.indexOf(',')\n    resolve(result.startsWith('data:image/') && comma >= 0 && result.length > comma + 1 ? result : null)\n  }\n  reader.onerror = () => resolve(null)\n  reader.readAsDataURL(file)\n})\n"""
if old not in s: raise SystemExit('helpers photo reader block not found')
p.write_text(s.replace(old, new, 1))

# offline-store.js: never persist an empty image blob
p = Path('src/offline-store.js')
s = p.read_text()
old = """export async function putOfflineBlob(blob, meta = {}) {\n  if (!storageAvailable()) throw new Error('Archiviazione offline non disponibile su questo dispositivo')\n  if (!(blob instanceof Blob)) throw new Error('Foto offline non valida')\n  const id = makeOfflineId('offline-blob')\n"""
new = """export async function putOfflineBlob(blob, meta = {}) {\n  if (!storageAvailable()) throw new Error('Archiviazione offline non disponibile su questo dispositivo')\n  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('Foto offline vuota o non valida')\n  const id = makeOfflineId('offline-blob')\n"""
if old not in s: raise SystemExit('offline blob block not found')
p.write_text(s.replace(old, new, 1))

# photo-storage.js: validate data URLs/offline blobs before upload
p = Path('src/photo-storage.js')
s = p.read_text()
s = s.replace("""  const [head, body] = String(dataUrl).split(',', 2)\n  const mime = head.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'\n  const binary = atob(body || '')\n""", """  const [head, body] = String(dataUrl).split(',', 2)\n  if (!body) throw new Error('Foto vuota o non valida')\n  const mime = head.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'\n  const binary = atob(body)\n  if (!binary.length) throw new Error('Foto vuota o non valida')\n""", 1)
s = s.replace("""    if (!row?.blob) throw new Error('Foto offline non più disponibile sul dispositivo')\n    return { blob: row.blob, cleanupId: id }\n""", """    if (!row?.blob || row.blob.size <= 0) throw new Error('Foto offline non più disponibile o vuota sul dispositivo')\n    return { blob: row.blob, cleanupId: id }\n""", 1)
s = s.replace("""  const materialized = await materializePhoto(value)\n  const ext = extensionFor(materialized.blob)\n""", """  const materialized = await materializePhoto(value)\n  if (!materialized?.blob || materialized.blob.size <= 0) throw new Error('Foto vuota: caricamento annullato')\n  const ext = extensionFor(materialized.blob)\n""", 1)
p.write_text(s)

# Issues.jsx: compact thumbnail + fallback + fullscreen lightbox
p = Path('src/randapp/Issues.jsx')
s = p.read_text()
anchor = """function IssueDetail({ issue, user, users, onClose, onUpdate, onDelete }) {\n"""
component = """function IssuePhoto({ src, alt }) {\n  const [failed, setFailed] = useState(false)\n  const [open, setOpen] = useState(false)\n  useEffect(() => { setFailed(false); setOpen(false) }, [src])\n  useEffect(() => {\n    if (!open) return undefined\n    const close = (event) => { if (event.key === 'Escape') setOpen(false) }\n    document.addEventListener('keydown', close)\n    return () => document.removeEventListener('keydown', close)\n  }, [open])\n  if (!src || failed) return <div className=\"rs-photo-unavailable\"><Icon name=\"image\" /><span>Foto non disponibile</span></div>\n  return <>\n    <button type=\"button\" className=\"rs-detail-photo-button\" onClick={() => setOpen(true)} aria-label={`Ingrandisci ${alt}`}>\n      <img className=\"rs-detail-photo\" src={src} alt={alt} onError={() => setFailed(true)} />\n      <span className=\"rs-detail-photo-hint\">Tocca per ingrandire</span>\n    </button>\n    {open && <div className=\"rs-photo-lightbox\" role=\"dialog\" aria-modal=\"true\" aria-label={alt} onClick={() => setOpen(false)}>\n      <button type=\"button\" className=\"rs-photo-lightbox__close\" onClick={() => setOpen(false)} aria-label=\"Chiudi foto\">×</button>\n      <img src={src} alt={alt} onError={() => { setFailed(true); setOpen(false) }} onClick={(event) => event.stopPropagation()} />\n    </div>}\n  </>\n}\n\n"""
if anchor not in s: raise SystemExit('IssueDetail anchor not found')
s = s.replace(anchor, component + anchor, 1)
s = s.replace("""      {issue.photoData && <img className=\"rs-detail-photo\" src={issue.photoData} alt=\"Foto segnalazione\" />}\n""", """      {(issue.photoData || issue.photoPath) && <IssuePhoto src={issue.photoData} alt=\"Foto segnalazione\" />}\n""", 1)
s = s.replace("""{issue.completionPhotoData && <img className=\"rs-detail-photo\" src={issue.completionPhotoData} alt=\"Foto riparazione\" />}""", """{(issue.completionPhotoData || issue.completionPhotoPath) && <IssuePhoto src={issue.completionPhotoData} alt=\"Foto riparazione\" />}""", 1)
p.write_text(s)

# shell.css: compact image card and fullscreen viewer
p = Path('src/randapp/shell.css')
s = p.read_text()
old = ".rs-detail-photo { width: 100%; border-radius: 15px; border: 1px solid var(--rs-line); margin: 8px 0; }"
new = """.rs-detail-photo-button {\n  position: relative; display: block; width: min(100%, 250px); height: clamp(118px, 24vw, 165px);\n  margin: 10px 0; padding: 0; border: 1px solid var(--rs-line); border-radius: 15px; overflow: hidden;\n  background: var(--rs-surface); cursor: zoom-in; color: var(--rs-text);\n}\n.rs-detail-photo { width: 100%; height: 100%; display: block; object-fit: cover; margin: 0; }\n.rs-detail-photo-hint {\n  position: absolute; left: 8px; right: 8px; bottom: 8px; padding: 5px 8px; border-radius: 999px;\n  background: rgba(3, 6, 12, .68); color: #fff; font-size: .68rem; font-weight: 700; text-align: center; backdrop-filter: blur(8px);\n}\n.rs-photo-unavailable {\n  width: min(100%, 250px); min-height: 92px; margin: 10px 0; padding: 14px; border-radius: 15px;\n  display: flex; align-items: center; justify-content: center; gap: 9px; color: var(--rs-text-3);\n  background: var(--rs-surface); border: 1px dashed var(--rs-line-strong); font-size: .82rem;\n}\n.rs-photo-lightbox {\n  position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: max(20px, var(--rs-safe-top)) 16px max(20px, var(--rs-safe-bottom));\n  background: rgba(2, 5, 10, .94); backdrop-filter: blur(14px); cursor: zoom-out;\n}\n.rs-photo-lightbox > img { max-width: 100%; max-height: 92dvh; width: auto; height: auto; object-fit: contain; border-radius: 12px; cursor: default; }\n.rs-photo-lightbox__close {\n  position: fixed; top: calc(var(--rs-safe-top) + 14px); right: max(14px, env(safe-area-inset-right)); z-index: 121;\n  width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); background: rgba(15,23,42,.82);\n  color: #fff; font-size: 1.8rem; line-height: 1; cursor: pointer;\n}\n@media (min-width: 768px) { .rs-detail-photo-button, .rs-photo-unavailable { width: 280px; } .rs-detail-photo-button { height: 180px; } }"""
if old not in s: raise SystemExit('detail photo css not found')
p.write_text(s.replace(old, new, 1))

# regression tests
Path('test/photo-pipeline-hardening.test.js').write_text("""import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { readFile } from 'node:fs/promises'\n\nconst helpers = await readFile(new URL('../src/randapp/helpers.js', import.meta.url), 'utf8')\nconst storage = await readFile(new URL('../src/photo-storage.js', import.meta.url), 'utf8')\nconst offline = await readFile(new URL('../src/offline-store.js', import.meta.url), 'utf8')\nconst issues = await readFile(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')\nconst css = await readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')\n\ntest('empty photos are rejected before storage upload', () => {\n  assert.match(helpers, /!file\\.size/)\n  assert.match(storage, /blob\\.size <= 0/)\n  assert.match(offline, /blob\\.size <= 0/)\n})\n\ntest('issue photos use compact clickable previews with a fallback', () => {\n  assert.match(issues, /function IssuePhoto/)\n  assert.match(issues, /Foto non disponibile/)\n  assert.match(issues, /rs-photo-lightbox/)\n  assert.match(css, /width: min\\(100%, 250px\\)/)\n  assert.match(css, /cursor: zoom-in/)\n})\n""")
