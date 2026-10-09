# Audit branch → main (campione verificato, 2026-10-09)

**Sicurezza:** nessun branch cancellato. Questo report non è un mirror Git completo. Non eliminare riferimenti prima che sia stato creato e verificato un mirror/bundle esterno con i commit dei branch.

Il repository aveva 480 branch prima dell'aggiunta del branch di backup; successivamente 481. I confronti sotto indicano commit esclusivi (ahead) e commit di main mancanti (behind), non equivalenza funzionale.

## Già contenuti in main (ahead = 0)

| Branch | Ahead | Behind |
|---|---:|---:|
| refactor/randui-material-css-cascade-guard | 0 | 5 |
| backup/randui-pre-rebuild-20260916 | 0 | 844 |
| tmp-main-into-consolidated | 0 | 780 |
| tmp-main-into-consolidated-2 | 0 | 780 |
| tmp-main-into-consolidated-final | 0 | 780 |
| ui/login-caricamento | 0 | 10 |
| ui/struttura-responsive | 0 | 12 |
| ui/switch-tema | 0 | 9 |
| feat/operational-timeline | 0 | 336 |
| feat/operational-dock | 0 | 338 |
| feat/operational-detail-focus | 0 | 340 |
| feat/atheros-liquid-presence | 0 | 82 |
| chore/remove-zombie-code | 0 | 1755 |
| chore/supabase-space-separation | 0 | 135 |
| fix/ocean-stable-main | 0 | 380 |
| release/final-readiness-freeze | 0 | 316 |
| docs/readme-sync-20261001 | 0 | 187 |
| safety/pre-housekeeping-privacy-20260825 | 0 | 2508 |
| chore/final-ui-css-consolidation | 0 | 1739 |
| chore/integrate-impeccable-agent-reviews | 0 | 472 |
| chore/pause-vercel-git-deploys | 0 | 388 |
| chore/revert-randailive-misplaced-changes | 0 | 481 |
| chore/wake-rand-ecosystem | 0 | 576 |
| codex/phase-0-foundation-certification | 0 | 844 |
| feat/consolidated-final-review | 0 | 644 |
| feat/operational-detail-convergence | 0 | 331 |
| feat/rand-ecosystem-heartbeats | 0 | 592 |

## Commit esclusivi: richiedono review del codice

| Branch | Ahead | Behind |
|---|---:|---:|
| fix/issue-detail-mobile-compact-lines | 3 | 1 |
| chore/rand-agent-rules-consolidation-20261009 | 7 | 4 |
| fix/randui-home-ios-card-overlap | 5 | 0 |
| cursor/home-widgets-da75 | 1 | 445 |
| codex/phase-2-mobile-randui | 6 | 849 |
| chore/freeze-agent-main | 3 | 917 |
| fix/randui-mobile-gutter-home-empty | 3 | 954 |
| feature/randai-smart-maintenance-guided-procedures | 8 | 1858 |
| audit/zombie-code-20260831 | 2 | 1768 |
| chore/digitalocean-controlled-deploy | 1 | 1836 |
| chore/randapp-agent-toolchain | 85 | 1865 |
| chore/vercel-controlled-deploys | 1 | 1835 |
| ci/shared-contract-diagnostics | 8 | 1527 |
| codex/phase-1-identity-authorization | 4 | 849 |
| codex/phase-3-governed-resolve | 12 | 849 |
| codex/phase-5-randcore-cadence | 17 | 849 |
| cursor/ops-planning-ui-density-947b | 3 | 461 |
| cursor/fixed-header-scroll-da75 | 1 | 448 |
| docs/randui-phase0-baseline | 13 | 854 |

## Regole prima della pulizia

1. Eseguire un `git clone --mirror` e copia su destinazione indipendente con verifica `git fsck --full` e presenza dei SHA di tutte le refs.
2. Conservare ogni riferimento/commit esclusivo anche nel registro di archiviazione.
3. Non cancellare branch collegati a PR aperte, deploy, release, protezioni o backup richiesti.
4. Effettuare un confronto dei file sui branch divergenti prima di decidere un recupero.
5. Cancellare soltanto dopo prova di recuperabilità del backup; aggiornare questo report con data, SHA, esito e motivo per ogni branch.

Il report è preliminare: non certifica tutti i branch.
