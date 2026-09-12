# RandMind 2.0 — Verified memory, temporal recall and governed retention

## Decisione
RandMind 2.0 **estende** il RandMind già LIVE. Non introduce Memory2, vector DB canonico o secondo store. `MemoryEngine`, `RandMind` e `randai_memory_items` restano owner.

## Delta 2.0
1. **Verified audit ingestion**: solo record RandAudit `ACTION_OUTCOME` con `decision=SUCCEEDED` e reason code `OUTCOME_VERIFIED` possono diventare memoria verificata. La source è `governance_audit/<auditId>` e conserva correlation/intent/reason codes.
2. **Temporal recall**: `recallAt()` ricostruisce cosa era valido a un istante, usando `valid_from/valid_until`, `superseded_at` e `forgotten_at`.
3. **Conflict resolution governata**: il sistema può suggerire un winner con score spiegabile; i pareggi restano ambigui. La risoluzione DB richiede autorizzazione RandAI e supersede atomicamente i loser nello stesso scope.
4. **Retention planner**: genera candidati solo quando esiste una policy esplicita per la retention class. Non cancella nulla; `legal_hold` non è mai candidato. L'eventuale forget usa l'RPC già canonica `randmind_forget_memory`.
5. **Provenance/dedup**: indice univoco impedisce la stessa memoria verificata da stesso audit+contenuto nello stesso scope.

## Boundary
Un task `SUCCEEDED` o un audit di azione riuscita non è automaticamente verità. `OUTCOME_VERIFIED` è obbligatorio. RandMind non può modificare RandCore/RandSecure e non può eseguire remediation.

## Temporalità
Una memoria superseded/forgotten può essere storicamente valida prima di `superseded_at`/`forgotten_at`; il recall corrente continua invece a escluderla. Questo evita di perdere la storia pur mantenendo la verità corrente pulita.

## Connessioni future
- RandResearch può cercare evidenza quando un conflict group è ambiguo.
- RandAI HITL può presentare una conflict resolution proposta prima dell'RPC.
- Retrieval Graph/RAG restano projection ricostruibili sopra RandMind, non source of truth.

## Zombie check
Nessun componente Memory esistente va eliminato. `MemoryEngine`, `MemoryStore/SupabaseMemoryStore`, production gate e console hanno ownership distinta e vengono estesi. Nuove dipendenze runtime: zero.
