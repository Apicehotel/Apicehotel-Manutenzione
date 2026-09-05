const MAX_TITLE = 160
const MAX_SUBTITLE = 240
const MAX_META = 24
const MAX_SECTIONS = 16
const MAX_ROWS = 120
const MAX_TEXT = 2000

function text(value, max = MAX_TEXT) {
  if (value == null) return ''
  return String(value).trim().slice(0, max)
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, MAX_ROWS).map((row) => ({
    label: text(row?.label, 120),
    value: text(row?.value),
  })).filter((row) => row.label || row.value)
}

export function normalizePrintDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Documento di stampa non valido')
  const title = text(input.title, MAX_TITLE)
  if (!title) throw new TypeError('Titolo di stampa obbligatorio')

  const metadata = normalizeRows(input.metadata).slice(0, MAX_META)
  const sections = Array.isArray(input.sections)
    ? input.sections.slice(0, MAX_SECTIONS).map((section) => ({
      heading: text(section?.heading, 140),
      rows: normalizeRows(section?.rows),
      text: text(section?.text),
    })).filter((section) => section.heading || section.rows.length || section.text)
    : []

  return {
    title,
    subtitle: text(input.subtitle, MAX_SUBTITLE),
    metadata,
    sections,
    footer: text(input.footer, 300),
  }
}

export function renderPrintDocumentHtml(input) {
  const doc = normalizePrintDocument(input)
  const metadata = doc.metadata.length
    ? `<dl class="meta">${doc.metadata.map((row) => `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`).join('')}</dl>`
    : ''
  const sections = doc.sections.map((section) => {
    const rows = section.rows.length
      ? `<dl class="rows">${section.rows.map((row) => `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`).join('')}</dl>`
      : ''
    const body = section.text ? `<p>${escapeHtml(section.text)}</p>` : ''
    return `<section>${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ''}${body}${rows}</section>`
  }).join('')

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="color-scheme" content="light">
<title>${escapeHtml(doc.title)}</title>
<style>
  @page { size: auto; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; background: #fff; font: 12pt/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 18px; }
  h1 { margin: 0; font-size: 22pt; line-height: 1.15; }
  header p { margin: 6px 0 0; color: #444; }
  h2 { margin: 18px 0 8px; font-size: 14pt; }
  p { white-space: pre-wrap; }
  dl { margin: 0; }
  dl > div { display: grid; grid-template-columns: minmax(120px, 32%) 1fr; gap: 12px; padding: 6px 0; border-bottom: 1px solid #ddd; break-inside: avoid; }
  dt { font-weight: 650; color: #333; }
  dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .meta { margin-bottom: 16px; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #bbb; color: #555; font-size: 9pt; }
</style>
</head>
<body>
<header><h1>${escapeHtml(doc.title)}</h1>${doc.subtitle ? `<p>${escapeHtml(doc.subtitle)}</p>` : ''}</header>
${metadata}
${sections}
${doc.footer ? `<footer>${escapeHtml(doc.footer)}</footer>` : ''}
</body>
</html>`
}

export { escapeHtml }
