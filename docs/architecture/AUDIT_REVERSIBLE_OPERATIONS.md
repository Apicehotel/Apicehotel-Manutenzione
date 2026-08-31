# Audit & Reversible Operations — Reliability Block 38

## Obiettivo

Il Blocco 38 rende ricostruibile e reversibile una modifica operativa senza creare un secondo motore di autorizzazione.

Catena di riferimento:

`operazione → RLS/permessi → write → trigger audit → before/after → eventuale soft-delete → restore controllato`

## Decisioni

### KEEP

- `issue_events` per la storia funzionale delle Segnalazioni;
- `randai_action_audit` per l'audit specifico dell'Action Gateway RandAI;
- permission model/RLS del Blocco 37;
- Safe Write Engine e outbox esistenti.

Questi strumenti non vengono sostituiti: il nuovo `operational_audit_log` copre il livello trasversale DB che mancava.

### ADD

`public.operational_audit_log` è append-only per i client e registra:

- `operation_id` (`RND-OP-*` quando fornito da una RPC, altrimenti fallback `RND-AUD-*`);
- hotel, attore e ruolo;
- modulo/azione;
- tipo/id record;
- `before_state` e `after_state`;
- source/outcome/metadata/timestamp.

I client autenticati non possono inserire, modificare o cancellare l'audit. La lettura è concessa solo a chi passa `can_admin_hotel(hotel_id)`.

Il trigger `capture_operational_audit()` copre Segnalazioni, Interventi, Planning Lavori e giorni Planning. Il telefono del tecnico viene rimosso dagli snapshot audit per data minimization.

### UPGRADE — cancellazioni reversibili

I domini critici ricevono metadati:

`deleted_at / deleted_by_user_id / deleted_reason / delete_operation_id`

`restored_at / restored_by_user_id / restore_operation_id`

Le normali SELECT/UPDATE vedono solo record con `deleted_at IS NULL`.

Per compatibilità con vecchi client, offline/outbox e percorsi già esistenti, un trigger `BEFORE DELETE` converte una DELETE già autorizzata dalle RLS in soft-delete. La RLS DELETE originale rimane quindi il gate che decide se la richiesta può arrivare al trigger.

Questo evita una migrazione fragile di ogni `.delete()` nel frontend nello stesso rilascio.

### Restore

RPC esplicite:

- `restore_issue(...)`;
- `restore_planning_work_day(...)`;
- `restore_intervention(...)`.

Esistono anche le RPC soft-delete esplicite equivalenti per i nuovi flussi.

Le RPC richiedono `RND-OP-*` e riutilizzano i permessi esistenti. Per Segnalazioni resta invariata la regola ownership: `issues.delete` oppure autore della propria segnalazione nello stesso hotel. Planning e Interventi richiedono il relativo permesso `delete`.

## Benchmark

Sono stati confrontati pgAudit/PostgreSQL e le indicazioni Supabase. pgAudit è utile per auditing SQL/session/object e compliance, ma non sostituisce un audit di dominio con `operationId`, before/after e restore. L'adozione globale di pgAudit è quindi **DEFER**: Supabase stesso raccomanda di limitarne attentamente lo scope per evitare grandi volumi di log.

Per RandApp il pattern migliore è ibrido:

- audit di dominio append-only nel database;
- eventi funzionali esistenti;
- pgAudit eventualmente in futuro per audit infrastrutturale/compliance mirato.

## Vincoli

- audit ≠ autorizzazione;
- soft-delete ≠ backup;
- restore non bypassa hotel/ruolo/ownership;
- una risposta SQL positiva non sostituisce il read-back del Safe Write Engine;
- niente dati di autenticazione, PIN o segreti negli snapshot;
- i record cancellati non devono rientrare nelle query/realtime operative ordinarie.

## Definition of Done

1. audit append-only protetto da RLS/grant;
2. before/after su domini critici;
3. delete legacy trasformate in soft-delete;
4. deleted rows escluse da SELECT/UPDATE ordinarie;
5. restore server-side con permessi esistenti;
6. test strutturali verdi;
7. migrazioni verificate sullo schema reale;
8. CI, browser e device gate verdi;
9. README allineato.
