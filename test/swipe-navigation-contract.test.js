import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('swipe-left opens the existing hidden menu target without replacing the drawer', async () => {
  const [swipe, shell, nav, css] = await Promise.all([
    read('src/randapp/swipe-navigation.js'),
    read('src/randapp/Shell.jsx'),
    read('src/randapp/shell-navigation.js'),
    read('src/randapp/app-shell-foundation.css'),
  ])
  assert.match(swipe, /document\.querySelector\('\[data-testid="nav-menu"\]'\)\?\.click\(\)/)
  assert.match(shell, /if \(item\.id === 'menu'\) \{ setDrawer\(true\); return \}/)
  assert.match(nav, /id: 'inventory'.*slot: 5|slot: 5, id: 'inventory'/s)
  assert.match(nav, /slot: 6, id: 'menu'.*gestureOnly: true/s)
  assert.match(css, /\.rs-navbtn\[data-slot='6'\]/)
})
