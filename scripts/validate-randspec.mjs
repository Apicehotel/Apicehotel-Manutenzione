import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('../specs/', import.meta.url));
const required = ['spec.md', 'plan.md', 'tasks.md', 'change-log.md'];
const taskStates = new Set(['TODO', 'DOING', 'BLOCKED', 'DONE', 'CANCELLED']);
const errors = [];

function text(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

if (!existsSync(rootPath)) {
  errors.push('specs/ directory is missing');
} else {
  const dirs = readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_template')
    .map((entry) => entry.name)
    .sort();

  if (dirs.length === 0) errors.push('at least one real RandSpec is required');

  for (const dir of dirs) {
    const base = join(rootPath, dir);
    const missing = required.filter((file) => !existsSync(join(base, file)));
    for (const file of missing) errors.push(`${dir}: missing ${file}`);
    if (missing.length) continue;

    const spec = text(join(base, 'spec.md'));
    const plan = text(join(base, 'plan.md'));
    const tasks = text(join(base, 'tasks.md'));
    const changes = text(join(base, 'change-log.md'));

    const requiredSpecHeadings = ['## Status', '## Problem', '## Outcome', '## Requirements', '## Acceptance criteria', '## Security and hotel isolation'];
    const requiredPlanHeadings = ['## Canonical owners', '## Current state', '## Proposed change', '## RandRadar decision', '## Rollback', '## Tests and evidence', '## Zombie check'];
    for (const heading of requiredSpecHeadings) if (!spec.includes(heading)) errors.push(`${dir}: spec missing ${heading}`);
    for (const heading of requiredPlanHeadings) if (!plan.includes(heading)) errors.push(`${dir}: plan missing ${heading}`);
    if (!changes.includes('## Changes')) errors.push(`${dir}: change-log missing ## Changes`);

    const declared = spec.match(/^# SPEC:\s+([^\s]+)\s+—/m)?.[1];
    if (declared !== dir) errors.push(`${dir}: SPEC id must match directory (found ${declared ?? 'NONE'})`);

    const taskLines = tasks.split('\n').filter((line) => /^- \[[A-Z_]+\]/.test(line));
    if (taskLines.length === 0) errors.push(`${dir}: no governed task lines found`);
    for (const line of taskLines) {
      const state = line.match(/^- \[([A-Z_]+)\]/)?.[1];
      if (!taskStates.has(state)) errors.push(`${dir}: invalid task state ${state}`);
      if (!/\b(?:T|C)\d{3}\b/.test(line)) errors.push(`${dir}: task lacks TNNN/CNNN id: ${line}`);
      if (!line.includes('Evidence:')) errors.push(`${dir}: task lacks Evidence: ${line}`);
    }

    if (/<SPEC_ID>|<TITLE>|<task atomico>|<Quale problema/.test(spec + plan + tasks + changes)) {
      errors.push(`${dir}: unresolved template placeholder`);
    }
  }
}

if (errors.length) {
  console.error('RandSpec validation FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('RandSpec validation OK');
