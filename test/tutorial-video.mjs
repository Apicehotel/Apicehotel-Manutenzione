import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({ headless: true, slowMo: 650 })
const context = await browser.newContext({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
  recordVideo: {
    dir: fileURLToPath(artifacts),
    size: { width: 412, height: 914 },
  },
})

const page = await context.newPage()
const output = fileURLToPath(new URL('tutorial-00-accesso-impostazioni.webm', artifacts))

await page.addInitScript(() => {
  const installTapIndicator = () => {
    if (document.getElementById('randapp-tutorial-style')) return
    const style = document.createElement('style')
    style.id = 'randapp-tutorial-style'
    style.textContent = `
      .randapp-tutorial-tap {
        position: fixed;
        z-index: 2147483647;
        width: 48px;
        height: 48px;
        margin: -24px 0 0 -24px;
        border: 4px solid rgba(0, 200, 255, .96);
        border-radius: 999px;
        background: rgba(0, 200, 255, .14);
        pointer-events: none;
        transform: scale(.45);
        opacity: 1;
        animation: randappTap .7s ease-out forwards;
      }
      @keyframes randappTap {
        65% { transform: scale(1.15); opacity: .9; }
        100% { transform: scale(1.55); opacity: 0; }
      }
    `
    document.documentElement.appendChild(style)
    document.addEventListener('pointerdown', (event) => {
      const dot = document.createElement('div')
      dot.className = 'randapp-tutorial-tap'
      dot.style.left = `${event.clientX}px`
      dot.style.top = `${event.clientY}px`
      document.body.appendChild(dot)
      setTimeout(() => dot.remove(), 800)
    }, true)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installTapIndicator, { once: true })
  } else {
    installTapIndicator()
  }
})

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1600)

  await page.getByTestId('login-user-input').tap()
  await page.waitForTimeout(750)
  await page.getByTestId('login-user-input').fill('Randagio')
  await page.waitForTimeout(1200)
  await page.getByTestId('login-user-input').fill('')
  await page.waitForTimeout(900)

  await page.getByTestId('open-settings-link').tap()
  await page.getByRole('heading', { name: 'Impostazioni' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1800)

  await page.getByTestId('admin-pin-input').tap()
  await page.waitForTimeout(1200)

  await page.getByRole('button', { name: /RandApp/ }).tap()
  await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1800)
} finally {
  const video = page.video()
  await context.close()
  if (video) await video.saveAs(output)
  await browser.close()
}

console.log(`Tutorial video creato: ${output}`)
