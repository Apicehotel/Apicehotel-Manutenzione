import { mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const outputDir = resolve('test/tutorial-artifacts')
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true, slowMo: 450 })
const pixel = devices['Pixel 7']
const context = await browser.newContext({
  ...pixel,
  viewport: { width: 412, height: 915 },
  recordVideo: {
    dir: outputDir,
    size: { width: 412, height: 915 },
  },
})

const page = await context.newPage()
try {
  await page.addInitScript(() => {
    localStorage.setItem('apicehotel.theme.v1', 'light')
    localStorage.setItem('apicehotel.ui-size.v1', 'normal')
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1400)

  // Percorso reale, sicuro e non distruttivo: Login -> Impostazioni -> ritorno a RandApp.
  await page.getByTestId('open-settings-link').click()
  await page.getByRole('heading', { name: 'Impostazioni' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(2200)

  await page.getByRole('button', { name: /RandApp/ }).click()
  await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1800)

  const video = page.video()
  await page.close()
  const generatedPath = await video.path()
  await copyFile(generatedPath, resolve(outputDir, 'RandApp-Tutorial-00-Navigazione.webm'))
  console.log('TUTORIAL VIDEO OK: test/tutorial-artifacts/RandApp-Tutorial-00-Navigazione.webm')
} finally {
  await context.close()
  await browser.close()
}
