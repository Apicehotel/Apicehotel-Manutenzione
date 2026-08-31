# Unified Validation & State Transition Layer — Blocco 35

## Obiettivo

Il Blocco 35 introduce un contratto di validazione condiviso prima delle scritture operative. Il Context & Scope Guard del Blocco 34 stabilisce **chi/dove/su quale record** può operare; questo layer stabilisce invece **se il payload e, quando noto, il cambio di stato sono semanticamente validi**.

Pipeline:

`Operation Envelope → Context/Scope Guard → Validation → Authorization/RLS → Safe Write → Verification → Audit`

## Decisione architetturale

Il confronto ha portato a questa matrice:

| Componente | Decisione | Motivo |
| --- | --- | --- |
| Validazioni di dominio già presenti | KEEP + UPGRADE | Le regole specialistiche, come `validateIssueTransition` del RandAI Action Gateway, conoscono il dominio meglio di una state machine generica. |
| `src/reliability/validation-engine.js` | ADD | Primitive comuni, reason code stabili e `OPERATION_VALIDATION_FAILED`, senza dipendenze runtime. |
| `src/reliability/domain-validation.js` | ADD | Contratti dichiarativi per segnalazioni, urgenti, planning lavori, planning sale e magazzino. |
| Data layer | UPGRADE progressivo | Il preflight appartiene al confine di scrittura, non soltanto ai form React, così vale anche per retry e percorsi programmatici. |
| Supabase/RLS/RPC | KEEP | Rimangono autorità server-side; la validazione client non è una barriera di sicurezza. |
| Zod | DEFER | Ottima soluzione soprattutto con TypeScript, ma oggi introdurrebbe un runtime aggiuntivo senza sostituire i controlli server/offline. Riesaminare con una futura migrazione dei contratti a TypeScript. |
| XState | NO ADD | Eccessivo per le transizioni operative attuali; il progetto possiede già runtime durevole e policy di dominio specialistiche. |

## Regole

1. Fallire presto prima della query quando un payload è sicuramente invalido.
2. Usare allowlist per stati, urgenze e valori enumerati.
3. Separare validazione sintattica e semantica da autorizzazione.
4. Non inventare limiti di lunghezza o soglie che lo schema/dominio non dichiara.
5. Non eseguire una lettura nascosta solo per validare una transizione: quando serve lo stato corrente, la verifica viene eseguita dal dominio che già lo possiede o dal Safe Write Engine del Blocco 36.
6. Le regole specialistiche del RandAI Action Gateway restano autorevoli per le azioni RandAI e non vengono rimpiazzate da una state machine generica.
7. Offline queue, retry e percorsi programmatici devono convergere sugli stessi contratti di validazione quando vengono portati nel Safe Write Engine.

## Contratti correnti

- Segnalazioni: hotel/camera/descrizione richiesti, stato e urgenza in allowlist; grafo di transizione disponibile quando è noto lo stato corrente.
- Urgenti: hotel/nota richiesti, gravità e stato in allowlist; transizioni terminali protette quando lo stato corrente è noto.
- Planning lavori: hotel, descrizione e almeno una data valida; stato in allowlist.
- Planning sale: struttura/sala/date valide, intervallo cronologico, pax intero non negativo, stato in allowlist.
- Magazzino: hotel/nome, quantità e soglia non negative; movimento di stock finito e diverso da zero.

## Wiring operativo del Blocco 35

Il primo wiring diretto è applicato ai data layer con invarianti numeriche/temporali ad alto rischio (`planning-work-data.js` e `inventory-data.js`). I contratti degli altri domini sono già condivisi e testati; il Blocco 36 li porta nel Safe Write Engine unico, evitando di duplicare la stessa logica in ogni file offline/online.

Questa scelta è intenzionale: il Blocco 35 definisce e prova il contratto; il Blocco 36 centralizza il percorso di scrittura, idempotenza, optimistic concurrency, retry e read-back. Inserire ora wrapper differenti in ogni data layer aumenterebbe la duplicazione che il Blocco 36 deve eliminare.

## Error contract

Le violazioni lanciano `OperationValidationError` con:

- `code = OPERATION_VALIDATION_FAILED`;
- `issues[]` immutabile;
- per ogni issue: `path`, `code`, `message`, `meta`.

I codici sono stabili e adatti a UI, diagnostica e Failure Intelligence successiva.

## Definition of Done

Il Blocco 35 è completo quando motore, contratti, wiring iniziale ad alto rischio, test e README sono allineati e la CI completa è verde. Il Blocco 36 deve riusare questi contratti invece di crearne una seconda copia.
