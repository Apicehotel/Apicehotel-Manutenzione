import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const matrixPath = path.join(root, 'test', 'quality-matrix.json')
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))

const requiredRisks = ['auth-session','permissions','hotel-isolation','maintenance-lifecycle','offline-sync','housekeeping','notifications','work-home','pwa-platform','weather-operations']
const requiredHotels = ['hotelgio','chocohotel','brigantino']
const requiredPlatforms = ['ios-webkit','android-chromium','windows-chromium']
const requiredNetwork = ['online','offline','reconnect']

for (const value of requiredHotels) if (!matrix.hotels?.includes(value)) throw new Error(`Quality matrix: hotel mancante ${value}`)
for (const value of requiredPlatforms) if (!matrix.platforms?.includes(value)) throw new Error(`Quality matrix: piattaforma mancante ${value}`)
for (const value of requiredNetwork) if (!matrix.networkStates?.includes(value)) throw new Error(`Quality matrix: stato rete mancante ${value}`)

const ids = new Set((matrix.criticalRisks || []).map((risk) => risk.id))
for (const id of requiredRisks) if (!ids.has(id)) throw new Error(`Quality matrix: rischio critico mancante ${id}`)

for (const risk of matrix.criticalRisks || []) {
  if (!risk.tests?.length) throw new Error(`Quality matrix: ${risk.id} senza test`)
  for (const file of risk.tests) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Quality matrix: file inesistente ${file} (${risk.id})`)
  }
}

console.log(`Quality matrix OK: ${matrix.criticalRisks.length} rischi critici, ${matrix.hotels.length} hotel, ${matrix.platforms.length} piattaforme, ${matrix.networkStates.length} stati rete`)
