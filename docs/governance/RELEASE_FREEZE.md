# RandApp Release Freeze — LTS 1.0

## Stato
**FROZEN** dopo il merge umano del gate finale.

Orizzonte operativo: **12 mesi** di stabilità. La release web/PWA resta il target canonico; non si riapre sviluppo funzionale continuo durante questo periodo.

## Cambi ammessi
- bugfix circoscritti;
- sicurezza;
- recovery / affidabilità;
- documentazione coerente con lo stato reale.

Ogni cambio continua a usare branch dedicato → CI → PR → **revisione umana** → merge umano. Nessun agente può fare push/merge/deploy diretto su `main`.

## Cambi congelati
Feature nuove, refactor architetturali, schema dati non necessario, major dependency upgrade e redesign restano fuori dal ciclo LTS. Possono entrare solo come eccezione esplicita con:
1. approvazione umana;
2. rollback documentato;
3. release gate verde;
4. motivazione registrata in RandSpec/change-log.

## Stato distribuzione
- **Web/PWA:** target di release canonico. Deve risultare `READY` da `npm run release:check`.
- **Android nativo:** resta `BLOCKED` finché mancano pacchetto firmato e prova su dispositivo reale. `npm run release:check:android` è volutamente fail-closed.
- **iOS privata / Apple Business Manager:** non viene dichiarata pronta senza pipeline di firma/distribuzione e prova reale; resta fuori dal freeze web.
- **Windows/desktop:** supportato come PWA/browser verificato; un eventuale installer nativo firmato è un target separato futuro.

## Produzione e ambienti
- Vercel Git auto-deploy resta disattivato.
- Ocean resta preview/test.
- Deploy produzione è human-only.
- `main` non viene toccato direttamente dagli agenti.

## Recovery
Il rollback usa i meccanismi canonici già presenti (`src/deployment-recovery.js`, workflow/deploy governati e storico Git). Nessun secondo sistema di rollback viene introdotto.

## Riapertura del ciclo
Il freeze termina solo con decisione umana esplicita e una nuova RandSpec di ciclo/release. RandRadar può continuare a osservare e classificare fonti senza installare runtime automaticamente.
