import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('point 10 keeps the legacy cleanup scan and documented compatibility aliases', () => {
  const script = fs.readFileSync('scripts/check-legacy-references.mjs', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.match(script, /forbiddenArtifacts/);
  assert.match(script, /compatibility/);
  assert.match(readme, /legacy|zombie/i);
  assert.match(fs.readFileSync('src/App.jsx', 'utf8'), /randapp\/App\.jsx/);
});
