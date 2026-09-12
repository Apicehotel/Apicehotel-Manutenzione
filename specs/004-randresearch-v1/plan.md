# PLAN: 004-randresearch-v1

## Canonical owners
- RandKnowledge Gateway: autorizzazione e retrieval interno — riuso.
- RandMind: memoria canonica verificata — riuso; RandResearch non salva automaticamente verità.
- RandCore/RandDurableRuntime: lifecycle durevole — riuso futuro per run lunghi.
- RandAudit: evidence decisionale — riuso come boundary di promozione.
- RandResearch: nuovo owner solo per ricerca approfondita, evidence assembly e ship gate.

## Current state
Non esiste un modulo `research` nel repository. Esistono già knowledge retrieval, provenance, temporal memory, durable workflow e security boundary; duplicarli sarebbe un errore.

## Proposed change
1. Core RandResearch dependency-free con livelli L0-L4, canonical query e budget.
2. Source normalization/scoring, contradiction detector, gap detector e ship gate.
3. Coordinator bounded con `research:execute` + `knowledge:read` e stesso hotel.
4. Adapter Supabase per sessioni/fonti e migration RLS/service-role-only.
5. Group 6, RandSpec, README/architecture/ecosystem.

## RandRadar decision
Hyperresearch: **ADOPT PATTERNS / NON INSTALLARE**. MIT, ottimo per query canonica, tier adattivi, resume, critic/audit, provenance e persistent vault; runtime Python/Claude Code duplicherrebbe RandCore/RandKnowledge. Agentic Wiki/LLM-Wiki: **SOURCE ONLY** per principio source-of-truth ricostruibile; evitare runtime GPL o owner paralleli.

## Rollback
Il modulo è additive e isolato. Rimuovere research runtime/store/migration/export lascia RandKnowledge, RandMind, RandCore e RandAudit invariati.

## Tests and evidence
- `test/randai-group6-randresearch.test.js`: auth, hotel isolation, levels, provenance, contradictions, gaps, injection risk, audit gate, DB contract.
- `.github/workflows/randai-group6-randresearch.yml`: Group 6 + regressione Group 5/4 + RandSpec.
- CI generale conserva build, shared contracts, browser/device, health e LTS.

## Zombie check
Nessun owner esistente è zombie. RandResearch usa retrieval e memoria esistenti; non crea browser, vector DB, scheduler o orchestratore alternativi.

## Future connections
- Punto 6 HITL userà `requiresHumanReview` e ship gate L3/L4.
- Punto 7 MCP/Gateway potrà fornire source adapter, mantenendo RandResearch come owner della pipeline.
- Solo risultati approvati/verificati potranno entrare in RandMind tramite il trust boundary del Punto 4.
