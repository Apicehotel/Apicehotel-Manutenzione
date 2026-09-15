import fs from 'node:fs';
import path from 'node:path';

const forbidden = [
  'src/clean-ui.css',
  'src/approved-dark-shell.css',
  'src/unified-ui-v1.css',
  'src/randapp/migrated.css',
  'src/randapp/randapp-layout-overhaul.css',
  'src/randapp/admin-mobile-v2.css'
];
const missing = forbidden.filter((file) => fs.existsSync(file));
const compatibility = fs.readFileSync('src/App.jsx', 'utf8');
if (!/randapp\/App\.jsx/.test(compatibility)) missing.push('src/App.jsx (compatibility alias drift)');

const result = { status: missing.length ? 'BLOCKED' : 'CLEAN', forbiddenArtifacts: missing };
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
