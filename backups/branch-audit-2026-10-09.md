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

| Branch | Ahead | Behind |
|---|---:|---:|
| `codex/agent-native-action-contract` | 0 | 357 |
| `codex/fix-operations-mobile-spacing` | 14 | 849 |
| `codex/fix-supply-portal-chunking` | 11 | 849 |
| `codex/group-3-release-readiness` | 11 | 849 |
| `codex/multihotel-feature-parity` | 13 | 849 |
| `codex/point-4-tiled-collision` | 0 | 486 |
| `codex/point-10-legacy-cleanup` | 10 | 849 |
| `codex/punto-7-gateway-core` | 0 | 852 |
| `codex/punto-7-randgateway` | 2 | 854 |
| `codex/randai-dashboard-mobile-actions` | 1 | 1182 |
| `codex/randai-theme-control` | 1 | 1181 |
| `codex/randai-unified-admin-center` | 1 | 1180 |
| `codex/randailive-map-alignment` | 3 | 485 |
| `cursor/close-non-wa-gaps-1e9a` | 5 | 446 |
| `cursor/fix-ocean-login-banner-loading-1e9a` | 1 | 458 |
| `cursor/fix-ops-title-flex-space-1e9a` | 1 | 455 |
| `cursor/fix-planning-task-ops-order-1e9a` | 1 | 457 |
| `cursor/fix-title-flex-basis-all-pages-1e9a` | 1 | 454 |
| `cursor/home-desk-desktop-da75` | 1 | 443 |
| `cursor/home-first-viewport-da75` | 2 | 444 |
| `cursor/home-presence-busy-da75` | 2 | 447 |
| `cursor/honest-list-states-da75` | 1 | 450 |
| `cursor/hub-choice-title-nowrap-1e9a` | 2 | 453 |
| `cursor/hub-preview-fast-load-1e9a` | 2 | 453 |
| `cursor/login-exact-name-match-1e9a` | 1 | 459 |
| `cursor/nav-switch-perf-446a` | 1 | 348 |
| `cursor/ntfy-deploy-smoke-a131` | 1 | 349 |
| `cursor/ntfy-gestione-a131` | 4 | 351 |
| `cursor/ntfy-selettore-struttura-a131` | 1 | 350 |
| `cursor/ops-task-preview-cards-1e9a` | 2 | 454 |
| `cursor/page-load-deep-dive-e340` | 1 | 352 |
| `cursor/page-load-deep-hardening-e340` | 1 | 353 |
| `cursor/page-load-hardening-e340` | 3 | 354 |
| `cursor/randai-chat-page-da75` | 2 | 441 |
| `cursor/randai-effective-assistant-1e9a` | 1 | 438 |
| `cursor/randai-fullpage-fix-da75` | 1 | 436 |
| `cursor/randai-page-layout-da75` | 1 | 437 |
| `cursor/randai-segnalazioni-canonical-1e9a` | 2 | 439 |
| `cursor/randai-tab-chat-da75` | 1 | 442 |
| `cursor/readme-ops-density-docs-947b` | 1 | 460 |

**Risultato batch:** 3 behind, 37 divergenti. Totale campione cumulativo dichiarato in chat 86; eventuali doppi conteggi da escludere nel riepilogo finale. Nessuna eliminazione o merge.

## Step feat/feature — batch 1

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/block-25-randui-live` | 0 | 1201 |
| `feat/block-26-randaudio` | 0 | 1200 |
| `feat/block-27-viking` | 0 | 1199 |
| `feat/block-28-product-completion` | 0 | 1198 |
| `feat/consolidated-randui-standardization-v1` | 0 | 726 |
| `feat/consumi-vercel` | 0 | 2265 |
| `feat/contextual-randai-focus` | 0 | 334 |
| `feat/hotelgio-telegram-history-backfill` | 0 | 491 |
| `feat/i-miei-lavori` | 0 | 2261 |
| `feat/interventi-detail` | 0 | 2389 |
| `feat/nuovo-intervento-form` | 1 | 2388 |
| `feat/pannello-consumi` | 0 | 2269 |
| `feat/piece-decision` | 0 | 2403 |
| `feat/planning-counts-operations-task` | 7 | 469 |
| `feat/post-randui-randai-ui-foundation` | 1 | 785 |
| `feat/prompts-chat-cursor-claude` | 7 | 23 |
| `feat/prompts-chat-randskills` | 12 | 25 |
| `feat/public-issue-link` | 0 | 2397 |

## Step feat/feature — batch 2

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/rand-final-repo-closure` | 29 | 856 |
| `feat/rand-foundations-group1` | 20 | 856 |
| `feat/rand-governance-v1` | 0 | 807 |
| `feat/rand-mcp-capability-bridge` | 0 | 237 |
| `feat/rand-mcp-foundation` | 9 | 252 |
| `feat/rand-operational-group2` | 26 | 856 |
| `feat/randai-block-27-context-envelope` | 0 | 1822 |
| `feat/randai-block-27-exec` | 0 | 1814 |
| `feat/randai-block-27-final` | 0 | 1822 |
| `feat/randai-block-27-final-impl` | 0 | 1822 |
| `feat/randai-block-27-main` | 0 | 1822 |
| `feat/randai-block-27-operational-context` | 0 | 1822 |
| `feat/randai-block-27-operational-context-impl` | 0 | 1822 |
| `feat/randai-block-27-operational-context-v2` | 0 | 1822 |
| `feat/randai-block-27-work` | 0 | 1822 |
| `feat/randai-block-27` | 6 | 1822 |
| `feat/randai-block-28-action-gateway` | 0 | 1799 |
| `feat/randai-control-center-randui-v1` | 0 | 782 |

## Step feat/feature — batch 3

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/randai-hybrid-verification` | 0 | 1165 |
| `feat/randai-native-surface-v1` | 0 | 785 |
| `feat/randai-point-3-issue-operations` | 13 | 1543 |
| `feat/randai-point-4-technician-dispatch` | 16 | 1542 |
| `feat/randai-point-5-control-center` | 10 | 1541 |
| `feat/randai-repository-registry` | 0 | 305 |
| `feat/randai-runtime-hitl-v1` | 0 | 747 |
| `feat/randailive-living-hotel-v2` | 0 | 548 |
| `feat/randailive-melon-hotel-v1` | 0 | 510 |
| `feat/randailive-phaser-grid-yuka` | 0 | 529 |
| `feat/randailive-pixel-world` | 0 | 567 |
| `feat/randapp-context-scope-guard` | 14 | 1628 |
| `feat/randapp-context-scope-guard-v2` | 6 | 1627 |
| `feat/randapp-live-runtime` | 0 | 573 |
| `feat/randapp-reliability-foundation` | 5 | 1628 |
| `feat/randarchitecture-block3` | 14 | 856 |
| `feat/randchat-group-a` | 20 | 1062 |
| `feat/randchat-group-b` | 19 | 1061 |

## Step feat/feature — batch 4

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/randchat-group-b-crypto` | 0 | 1061 |
| `feat/randchat-group-c` | 27 | 1059 |
| `feat/randcore-agent-control-center` | 0 | 640 |
| `feat/randcore-agent-dashboard` | 0 | 632 |
| `feat/randcore-agent-heartbeats` | 0 | 625 |
| `feat/randcore-capability-router` | 0 | 291 |
| `feat/randcore-main-protection-health` | 5 | 782 |
| `feat/randcore-repository-governance-v1` | 2 | 782 |
| `feat/randcore-runtime-v2` | 0 | 823 |
| `feat/randmcp-gateway-chat-v1` | 0 | 747 |
| `feat/randmind-learning-block2` | 12 | 952 |
| `feat/randmind-v2` | 1 | 770 |
| `feat/randresearch-v1` | 0 | 770 |
| `feat/randsale2d-editor-facchini` | 15 | 856 |
| `feat/randsale2d-history` | 8 | 856 |
| `feat/randsale2d-persistence` | 14 | 856 |
| `feat/randsale2d-planning-integration` | 2 | 856 |
| `feat/randsale2d-randai-proposal` | 12 | 856 |

## Step feat/feature — batch 5

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/randskills-foundation-block1` | 20 | 954 |
| `feat/randskills-governance-block2` | 0 | 924 |
| `feat/randskills-router-block1` | 0 | 933 |
| `feat/randskills-unified-manager` | 0 | 214 |
| `feat/randspec-v1` | 0 | 854 |
| `feat/randui-edera-theme-engine` | 190 | 563 |
| `feat/randui-free-library-integration` | 3 | 198 |
| `feat/randui-gentelella-rebuild` | 0 | 129 |
| `feat/randui-mobile-demo` | 1 | 26 |
| `feat/randui-next-home-rebuild` | 0 | 26 |
| `feat/randui-next-rebuild` | 0 | 27 |
| `feat/randui-real-home-showcase` | 0 | 194 |
| `feat/randui-rebuild-v1` | 0 | 827 |
| `feat/randui-standardization-v1` | 9 | 780 |
| `feat/randui-v2-from-zero` | 0 | 85 |
| `feat/randvisual-block2` | 7 | 856 |
| `feat/reliability-audit-reversible-operations` | 7 | 1622 |
| `feat/reliability-authz-rls-matrix` | 4 | 1624 |

## Step feat/feature — batch 6

| Branch | Ahead | Behind |
|---|---:|---:|
| `feat/reliability-offline-concurrency` | 0 | 1621 |
| `feat/reliability-offline-concurrency-2` | 12 | 1621 |
| `feat/reliability-safe-write-engine` | 10 | 1625 |
| `feat/reliability-unified-validation` | 11 | 1626 |
| `feat/richiedi-tecnico` | 0 | 2401 |
| `feat/room-status-suggestion` | 0 | 2419 |
| `feat/security-intelligence-block3` | 0 | 942 |
| `feat/tanstack-query-foundation` | 0 | 308 |
| `feat/tecnico-status-on-ask` | 0 | 2395 |
| `feat/telegram-backup-tickets` | 0 | 493 |
| `feat/trasforma-urgenza` | 0 | 2259 |
| `feat/wa-photo-link` | 0 | 2399 |
| `feature/adaptive-layout-system` | 2 | 2503 |
| `feature/adaptive-quick-actions` | 6 | 2498 |
| `feature/base-multihotel` | 8 | 2887 |
| `feature/free-widget-grid` | 3 | 2499 |
| `feature/home-1x3-personalize-menu` | 4 | 2504 |
| `feature/home-assistant-preview` | 31 | 1871 |

## Step feat/feature — batch 7

| Branch | Ahead | Behind |
|---|---:|---:|
| `feature/home-widget-grid` | 8 | 2505 |
| `feature/housekeeping-privacy-slope` | 28 | 2508 |
| `feature/mobile-npm-installer` | 1 | 2498 |
| `feature/navigation-profile-cleanup` | 3 | 2505 |
| `feature/new-issue-form-polish` | 3 | 2448 |
| `feature/photo-gallery-file-choice` | 0 | 2427 |
| `feature/randai-autonomy-recovery` | 10 | 1847 |
| `feature/randai-console` | 14 | 2887 |
| `feature/randai-console-foundation` | 4 | 1558 |
| `feature/randai-console-v2` | 7 | 1889 |
| `feature/randai-contextual-integration` | 7 | 1618 |
| `feature/randai-conversation-memory` | 8 | 1866 |
| `feature/randai-core-tool-registry` | 9 | 1865 |
| `feature/randai-discovery-supervisor` | 10 | 1843 |
| `feature/randai-durable-runtime` | 9 | 1861 |
| `feature/randai-evals-multi-agent` | 10 | 1856 |
| `feature/randai-hvac-routing` | 6 | 1870 |
| `feature/randai-issue-suggestions` | 7 | 1869 |

## Step feat/feature — batch 8

| Branch | Ahead | Behind |
|---|---:|---:|
| `feature/randai-maintenance-knowledge` | 8 | 1863 |
| `feature/randai-memory-context` | 10 | 1860 |
| `feature/randai-model-router-knowledge-gaps` | 11 | 1859 |
| `feature/randai-proactive-control-center` | 10 | 1842 |
| `feature/randai-project-observability` | 17 | 1848 |
| `feature/randai-role-auth` | 0 | 1873 |
| `feature/randai-skills-directives` | 10 | 1864 |
| `feature/randai-smart-maintenance-guidance` | 7 | 1858 |
| `feature/randai-software-learning` | 9 | 1846 |
| `feature/randapp-dark-shell-rebuild` | 0 | 2529 |
| `feature/randui-telegram-navigation` | 18 | 959 |
| `feature/randui-v1-block3-migration` | 0 | 992 |
| `feature/randui-v1-unification` | 0 | 996 |
| `feature/randui-visual-unification` | 0 | 970 |
| `feature/swipe-menu-navbar-slot` | 38 | 1617 |
| `feature/ui-components-glass` | 6 | 1619 |
| `feature/ui-components-theme-system` | 6 | 1619 |
| `feature/ui-shell-foundation` | 9 | 1620 |
