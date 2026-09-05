import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const desktopPackage = JSON.parse(read('desktop/package.json'))
const workflow = read('.github/workflows/randdesktop-windows.yml')

test('RandDesktop produce un installer NSIS Windows x64 riproducibile', () => {
  assert.equal(desktopPackage.devDependencies.electron, '44.2.0')
  assert.equal(desktopPackage.devDependencies['electron-builder'], '26.15.3')
  assert.equal(desktopPackage.build.appId, 'it.apicehotel.randdesktop')
  assert.equal(desktopPackage.build.productName, 'RandDesktop')
  assert.equal(desktopPackage.build.asar, true)
  assert.equal(desktopPackage.build.win.artifactName, 'RandDesktop-Setup-${version}.${ext}')
  assert.deepEqual(desktopPackage.build.win.target, [{ target: 'nsis', arch: ['x64'] }])
  assert.equal(desktopPackage.build.nsis.oneClick, false)
  assert.equal(desktopPackage.build.nsis.createDesktopShortcut, true)
  assert.equal(desktopPackage.build.nsis.createStartMenuShortcut, true)
})

test('installer incorpora la build locale RandApp senza caricare Vercel come renderer', () => {
  const resource = desktopPackage.build.extraResources.find((entry) => entry.to === 'app')
  assert.ok(resource)
  assert.equal(resource.from, '../dist')
  const main = read('desktop/main.mjs')
  assert.match(main, /process\.resourcesPath, 'app', 'index\.html'/)
  assert.doesNotMatch(main, /loadURL\(['"]https:\/\//)
})

test('workflow Windows costruisce asset relativi, checksum e artifact scaricabile', () => {
  assert.match(workflow, /runs-on:\s*windows-latest/)
  assert.match(workflow, /npm run build -- --base=\.\//)
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY:\s*'false'/)
  assert.match(workflow, /npm run package:win --prefix desktop/)
  assert.match(workflow, /Get-FileHash .* -Algorithm SHA256/)
  assert.match(workflow, /actions\/upload-artifact@v4/)
  assert.match(workflow, /release\/randdesktop\/\*\.exe/)
})
