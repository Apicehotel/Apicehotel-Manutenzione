# PLAN: 006-operational-detail-v1

## Canonical owners
- Shell.jsx: stato Focus Mode.
- OperationalDetailPage.jsx: chrome/scroll del dettaglio.
- Issues.jsx e InterventionsView.jsx: dati e azioni di dominio.

## Current state
Sheet è stato reso full-screen, ma resta una primitiva overlay e il dettaglio può convivere con il chrome della Shell.

## Proposed change
Sostituire l'overlay per i dettagli risorsa con una superficie inline full-screen governata dalla Shell. Le liste conservano stato/filtri ma non vengono renderizzate durante il dettaglio.

## RandRadar decision
- Decision: ADAPT
- Candidate/source: pattern work-order/detail già valutati (Atlas CMMS/TaloFix/TaskTrail); nessuna dipendenza runtime nuova.
- License: N/A — si adotta il pattern, non codice esterno.
- Rationale: a ridosso della consegna aggiungere router/framework aumenterebbe rischio e superficie di regressione.

## Architecture and boundaries
child domain -> onDetailChange({kind,id}) -> Shell Focus Mode -> OperationalDetailPage.
Nessuna autorità o permesso si sposta dalla logica esistente.

## Migration and rollout
1. Primitive + Focus Mode.
2. Segnalazioni.
3. Interventi.
4. Task/Rifornimenti riusano lo stesso contratto quando verrà introdotta una scheda item.

## Rollback
Un commit revert ripristina Sheet e chrome Shell; nessuna migrazione dati da annullare.

## Tests and evidence
- test/operational-detail-route.test.js
- CI canonica RandUI/build/e2e.
- Browser visual gate Ocean dopo merge.

## Zombie check
Sheet/Modal NON sono zombie: restano usati da filtri, notifiche, selettori e composer. Nessuna eliminazione prematura.
