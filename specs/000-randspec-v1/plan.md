# PLAN: 000-randspec-v1

## Canonical owners
- RandFlow: lifecycle canonico.
- RandCore: release/security gate.
- RandRadar: build-vs-reuse.

## Current state
RandFlow è già su main e la CI copre security audit, Quality Matrix, build, contratti, browser/device e RandCore evidence. Evitiamo un secondo orchestratore.

## Proposed change
Aggiungere un layer Markdown validabile per SPEC/PLAN/TASKS/CHANGE e una Constitution che formalizza le invarianti esistenti.

## RandRadar decision
- Decision: ADAPT
- Candidate/source: github/spec-kit
- License: MIT
- Rationale: adottare spec-driven development e converge come pattern; non aggiungere CLI/Python perché RandFlow/Node/CI sono già canonici.

## Architecture and boundaries
Solo governance repository: `specs/`, `docs/`, script Node e test. Nessun runtime PWA.

## Migration and rollout
Applicazione brownfield progressiva alle nuove modifiche sostanziali. Nessuna retro-migrazione forzata delle vecchie feature.

## Rollback
Revert della PR; nessun dato o schema da ripristinare.

## Tests and evidence
Validatore Node, test di governance, CI canonica.

## Zombie check
Nessuna rimozione. Spec Kit non viene installato; RandFlow non viene sostituito.
