# Rand Operational Group 2

Il Gruppo 2 consolida sei repository/pattern valutati nel perimetro operativo senza introdurre runtime paralleli.

## Regola

Ogni fonte esterna deve avere un proprietario canonico interno. Nessuna fonte del Gruppo 2 entra come dipendenza runtime e nessuna può sostituire implicitamente un proprietario Rand esistente.

## Classificazione

- `Expensify/App` → `SOURCE_ONLY`: pattern offline-first/collaboration; RandChat/RandApp restano proprietari.
- `MihanEntalpo/cryptboard.io` → `IGNORE_RUNTIME`: RandChat è già 9/9 con gruppi, DM E2EE, retention, Procedure, RandAI e media.
- `Caxerion2/Sistem-Housekeeping-Hotel` → `ADAPT`: viene adattato solo il workflow centrato sul piano.
- `magnitude-dev/magnitude` → `SOURCE_ONLY`: pattern di browser testing/agent QA, nessuna autorità produttiva.
- `anomalyco/opencode` → `SOURCE_ONLY`: pattern coding-agent; RandFlow/RandAgent Runtime restano canonici.
- `zhaoxuya520/reverse-skill` → `SOURCE_ONLY`: pattern di analisi security sandbox-only; RandCore resta autorità.

## Housekeeping Floor Context v1

`src/randapp/operations/housekeeping-floor-context.js` introduce un contesto operativo minimo e riusabile:

1. `hotelId` obbligatorio e bloccato per tutta la sessione Housekeeping.
2. Il primo piano assegnato diventa default, salvo selezione autorizzata esplicita.
3. Il cambio piano è separato dal cambio hotel e non può mai mutare implicitamente `hotelId`.
4. Se esiste un set di piani assegnati, il cambio è limitato a quel set.
5. `canChangeFloor` decide se l'utente può cambiare piano; il ruolo da solo non concede capacità.
6. Le segnalazioni create da Housekeeping vengono solo preparate come draft e persistono nel modulo `Issues`, usando i permessi esistenti.

Questo consente in futuro una UI `Cambia piano` simile concettualmente al selettore hotel, ma con hotel fermo e scope più stretto.

## Anti-zombie

Non vengono creati:

- un secondo sistema chat/E2EE;
- un secondo account utente;
- un secondo runtime coding-agent;
- un secondo motore security;
- un database o magazzino Housekeeping separato;
- una seconda pipeline Segnalazioni.

## Connessioni future

Il contesto piano può essere usato da Housekeeping UI, segnalazioni, rifornimenti, checklist camera/piano e, in seguito, warehouse/sale mappe. Ogni integrazione dovrà riusare `hotelId`, permessi e owner canonici già presenti.
