import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const page = await readFile(new URL('../src/randapp/TechnicianDirectoryView.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/randapp/technician-directory.css', import.meta.url), 'utf8')

test('technician directory is a dedicated RandUI page', () => {
  assert.match(shell, /import\('\.\/TechnicianDirectoryView\.jsx'\)/)
  assert.match(page, /title="Rubrica tecnici"/)
  assert.match(page, /data-testid="technicians-view"/)
  assert.match(css, /\.rs-technicians-page/)
})

test('technician directory exposes operational search filters and summary', () => {
  assert.match(page, /Cerca nome, ditta, telefono, competenza/)
  assert.match(page, /Filtra stato tecnico/)
  assert.match(page, /Filtra competenza/)
  assert.match(page, /Totali/)
  assert.match(page, /Attivi/)
  assert.match(page, /Impegnati/)
  assert.match(page, /Competenze/)
})

test('technician cards expose competencies contacts and dispatch activity', () => {
  assert.match(page, /technician_dispatch_requests/)
  assert.match(page, /external_technician_competencies/)
  assert.match(page, /WhatsApp/)
  assert.match(page, /incarichi/)
  assert.match(page, /ATTIVITÀ/)
  assert.match(page, /COMPETENZE/)
})

test('directory keeps governed edit operations through existing RPCs', () => {
  assert.match(page, /technician_manage_directory/)
  assert.match(page, /technician_set_competencies/)
  assert.match(page, /canManageTechnicianDirectory/)
  assert.match(page, /Nuovo tecnico/)
})
