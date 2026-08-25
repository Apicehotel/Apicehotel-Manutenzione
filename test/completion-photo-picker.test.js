import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('foto completamento usa il picker nativo senza stato legacy photoPickerOpen', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /className="completion-photo-field"/)
  assert.match(app, /className="photo-input native-photo-input" type="file" accept="image\/\*"/)
  assert.match(app, /const pickCompletionPhoto = async \(file\) => \{ const data = await readPhotoAsDataUrl\(file\); setCompletionPhoto\(data\); setCompletionPhotoName\(file\?\.name \|\| ''\) \}/)
  assert.doesNotMatch(app, /photoPickerOpen/)
  assert.doesNotMatch(app, /setPhotoPickerOpen/)
})
