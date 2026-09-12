# PLAN: 003-randmind-v2

## Canonical owners
- `RandMind` + `MemoryEngine`: semantica memoria/retrieval.
- `MemoryStore/SupabaseMemoryStore` + `randai_memory_items`: persistence.
- RandAudit: provenance degli outcome verificati.
- `randmind_forget_memory`: forgetting autorizzato.

## Current state
Lifecycle, retention class, validità, supersession, conflict group, forgetting audit e production gate esistono già. Mancano bridge da governance audit, `superseded_at`, recall as-of robusto, resolution RPC e retention planner.

## Proposed change
Estendere gli owner esistenti con helper evidence, timestamp di supersession, RPC conflict resolution, audit ingestion e API RandMind `recallAt/ingestVerifiedAudit/planRetention/resolveConflict`.

## RandRadar decision
Pattern `llm_wiki` (provenance/immutable raw), DeskcommCRM (append-only evidence) e HyperResearch (provenance/contradiction) sono già valutati e sufficienti. ADAPT patterns; nessuna nuova dipendenza.

## Rollback
La migration aggiunge una colonna, indici e RPC; nessuna tabella canonica sostituita. Disabilitando le nuove API RandMind v1 resta operativo.

## Tests and evidence
`test/randai-group5-randmind-v2.test.js`, Group 5 workflow, Group 4 boundary, CI generale.

## Zombie check
Nessun Memory owner è duplicato/zombie. Graph/RAG restano projection opzionali, non store canonici.
