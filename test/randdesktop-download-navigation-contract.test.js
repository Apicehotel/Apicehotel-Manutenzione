import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('download RandDesktop usa un permesso dedicato e non ruoli hardcoded nella UI', () => {
  const permissions = read('src/permissions.js')
  const nav = read('src/randapp/nav.js')
  assert.match(permissions, /'desktop_download'/)
  assert.match(permissions, /\['Direzione','Direttore Centro Congressi','Reception'\]/)
  assert.match(permissions, /fallback\.RandAI\.desktop_download=new Set\(\)/)
  assert.match(nav, /canUser\(user, 'desktop_download', 'view'\)/)
  assert.match(nav, /'desktop-download': view\('desktop_download'\)/)
  assert.doesNotMatch(nav, /user\?\.role\s*===\s*['"]Reception['"]/)
})

test('RandDesktop nasce nel menu laterale ed è configurabile da Ruoli e permessi', () => {
  const roleNavigation = read('src/randapp/role-navigation.js')
  const settings = read('src/randapp/admin/settings-constants.js')
  assert.match(roleNavigation, /\['desktop_download', 'RandDesktop'\]/)
  assert.match(roleNavigation, /'desktop-download': 'desktop_download'/)
  assert.match(roleNavigation, /desktop_download: 'side'/)
  assert.match(settings, /\['desktop_download', 'RandDesktop'\]/)
  assert.match(settings, /\['desktop_download','Download RandDesktop'\]/)
  assert.match(settings, /desktop_download:\['view'\]/)
})

test('pagina download usa configurazione centrale HTTPS e gestisce RandDesktop già attivo', () => {
  const page = read('src/randapp/RandDesktopDownload.jsx')
  const shell = read('src/randapp/Shell.jsx')
  assert.match(page, /VITE_RANDDESKTOP_DOWNLOAD_URL/)
  assert.match(page, /url\.protocol === 'https:'/)
  assert.match(page, /Boolean\(window\.randDesktop\)/)
  assert.match(page, /Installer in preparazione/)
  assert.match(page, /target="_blank"/)
  assert.match(page, /rel="noopener noreferrer"/)
  assert.match(shell, /import\('\.\/RandDesktopDownload\.jsx'\)/)
  assert.match(shell, /view === 'desktop-download'/)
})
