# RandUI / RandApp — Fase 0: baseline verificabile

**Data:** 12 settembre 2026  
**Repository:** [Apicehotel/Apicehotel-Manutenzione](https://github.com/Apicehotel/Apicehotel-Manutenzione)  
**Base verificata:** `main` al commit [b29ce65](https://github.com/Apicehotel/Apicehotel-Manutenzione/commit/b29ce65af434fedd6c6426f5f6304dba5db4bda2) (merge PR #243).

## Esito

La ricognizione remota conferma che RandUI esiste già come sistema canonico: catalogo pagine, contratto visuale, registry di template/componenti, PageBoundary e test dedicati. La roadmap iniziale sovrastimava il lavoro di fondazione e non distingueva l'inventario remoto dall'esecuzione visuale locale. La priorità corretta è verificare il rendering reale e poi correggere le incoerenze pagina per pagina, senza aggiungere un secondo design system.

## Inventario accertato

| Voce | Evidenza su `main` |
|---|---|
| Repository | Pubblico, attivo, default branch `main`, non archiviato |
| Stack applicativo | React 19, Vite 7, Supabase/Postgres; PWA secondo README |
| Destinazioni RandUI | **24**, enumerate in `src/randapp/randui/page-catalog.js` |
| Template | **14**, dichiarati in `src/randapp/randui/template-registry.js` e sincronizzati con `design-contract.js` |
| Componenti registrati | **22**, in `src/randapp/randui/component-registry.js` (incluso `TemplateFrame`) |
| Test visuali/browser presenti | Playwright è tra le dev dependency; script E2E e device acceptance presenti |
| Gate UI | `test:randui`, con comandi separati per guard, migration, visual, planning e navigation |
| Documentazione UI | Core, Guard, Migration, Visual Language e Telegram Navigation sotto `docs/architecture/` |
| Stato del branch | Sul commit di merge #243 l'endpoint Combined Status ha restituito zero status entries; non equivale a una certificazione locale del codice |

### Discrepanza documentale corretta

`RANDUI_V1_MIGRATION.md` riportava 23 destinazioni; il catalogo effettivo contiene 24. Il valore aggiornato riguarda le destinazioni censite nel catalogo, non certifica da solo che ogni pagina sia visivamente uniforme o coperta da screenshot.

## Baseline non eseguibile in questa sessione

- Il workspace contiene la roadmap, non il checkout dell'applicazione.
- Il tentativo di clone HTTPS è fallito perché il proxy di rete del workspace non è raggiungibile.
- Di conseguenza non sono stati eseguiti `npm ci`, build, test, E2E, test su device o acquisizione screenshot.
- Non è stato possibile ispezionare l'app autenticata in un browser né confrontare desktop/tablet/mobile.
- Non è stata rimossa alcuna pagina zombie: il catalogo statico non prova da solo l'assenza di utilizzo o dipendenze.

Questi limiti sono espliciti: nessun test viene dichiarato verde e nessuna immagine viene presentata come baseline.

## Scelte per la fase successiva

1. Non introdurre Storybook, un'altra libreria UI o un nuovo router prima di aver verificato ciò che già esiste.
2. Usare il catalogo RandUI come inventario iniziale e associare ogni destinazione a scopo, ruolo, azione primaria, stati e template.
3. Avviare il confronto visuale da Temperatura, ma solo dopo aver ottenuto una preview/browser autenticabile e screenshot reali.
4. Registrare una pagina zombie solo con prove su route, import, navigazione, permessi e persistenza.
5. Considerare PWA/iOS/Android/APK e desktop come profili di verifica distinti; il README dichiara target, ma questa ricognizione non li ha provati su dispositivi.

## Riferimenti di codice

- [Page catalog](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/randui/page-catalog.js)
- [Template registry](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/randui/template-registry.js)
- [Component registry](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/src/randapp/randui/component-registry.js)
- [Migration contract](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/docs/architecture/RANDUI_V1_MIGRATION.md)
- [RandUI test scripts](https://github.com/Apicehotel/Apicehotel-Manutenzione/blob/main/package.json)
