# RandUI — Punto 2: audit completo 24/24 pagine

## Obiettivo

Il Punto 2 non ridisegna 24 schermate una per una. Trasforma il catalogo RandUI gia canonico in una roadmap finita prima di Unified Page v2: ogni destinazione viene classificata `KEEP`, `ALIGN` o `REWORK`, con priorita e focus. Il catalogo e i 14 template restano gli unici proprietari della struttura.

Regola: adattare i template alle pagine con il minimo cambiamento necessario; niente secondo design system e niente librerie UI introdotte solo per uniformare l'aspetto.

## Risultato audit

| Pagina | Template | Decisione | Priorita | Focus |
| --- | --- | --- | --- | --- |
| Home | dashboard | ALIGN | P1 | gerarchia dashboard e ritmo verticale |
| Operativita | operational | ALIGN | P1 | densita hub e priorita destinazioni |
| Segnalazioni | list-detail | ALIGN | P1 | lista/dettaglio e azioni mobile |
| RandChat | master-detail | ALIGN | P1 | master/detail e leggibilita mobile |
| Housekeeping | operational | ALIGN | P1 | contesto piano e gerarchia azioni |
| Rifornimenti | operational | ALIGN | P1 | contesto area/piano e stati richiesta |
| Interventi | list-detail | ALIGN | P1 | filtri, dettaglio e risoluzione |
| Magazzino | management | ALIGN | P1 | densita gestionale e movimenti stock |
| Task / I miei lavori | operational | ALIGN | P1 | task assegnati e azione primaria |
| Planning lavori | planning | ALIGN | P1 | agenda mobile, timeline e creazione |
| Planning sale | planning | ALIGN | P1 | agenda mobile, timeline e creazione sale |
| Avvisi urgenti | list | ALIGN | P1 | priorita alert e acknowledge |
| Promemoria | list | ALIGN | P1 | scansione lista e stato temporale |
| Sensori | monitor | REWORK | P0 | gerarchia, stato e storico |
| Impianti | monitor | REWORK | P0 | stato, allarmi e storico |
| Rubrica tecnici | management | ALIGN | P1 | rubrica, disponibilita e creazione |
| Profilo | form | KEEP | P2 | form semplice / reading width |
| PIN | form | KEEP | P2 | credenziale focalizzata |
| Manuale | search-archive | ALIGN | P1 | ricerca, archivio e dettaglio |
| Feedback | form | KEEP | P2 | form singolo a basso carico cognitivo |
| Feedback ricevuti | list | ALIGN | P1 | lista amministrativa e revisione |
| RandDesktop | system-state | KEEP | P2 | stato centrato e azione singola |
| Impostazioni | settings | ALIGN | P1 | gerarchia amministrativa senza secondo menu |
| RandAI | monitor | ALIGN | P1 | dashboard intelligence, controlli e guide |

Totale: **24/24**. `KEEP=4`, `ALIGN=18`, `REWORK=2`. Priorita: `P0=2`, `P1=18`, `P2=4`.

## Decisione architetturale

La soluzione migliore non e creare altri template: il registry attuale copre gia le famiglie necessarie. Il prossimo blocco deve quindi introdurre **Unified Page v2** come evoluzione dei boundary/primitivi condivisi e del ritmo di spaziatura, poi applicarlo per adattamento. Sensori e Impianti sono le sole pagine che meritano un rework esplicito; le altre vanno allineate o mantenute.

Questo evita due errori: rifare da zero pagine che funzionano e accumulare CSS locale per correggere ogni schermata separatamente.

## Gate

`src/randapp/randui/page-audit.js` e `test/randui-page-audit-v2.test.js` rendono l'inventario fail-closed: se il catalogo non e piu 24/24 o nasce una pagina senza audit, il test fallisce. Ogni pagina deve continuare a risolvere un template canonico.

Le verifiche grafiche restano esclusivamente su **DigitalOcean/Ocean**. Vercel/main non sono un ambiente di prova RandUI.
