# RandApp — Device Acceptance

Questa checklist copre solo ciò che un runner CI non può certificare fisicamente. Tutto il resto è bloccato da `npm run test:device` e dalla CI.

## iPhone — Safari + PWA installata

- Aprire RandApp in Safari e aggiungerla alla schermata Home.
- Verificare nome `RandApp - Manutenzione` e icona corretta.
- Avviare in modalità standalone: nessuna barra Safari deve essere parte dell'app.
- Login: tastiera numerica sul PIN, nessun controllo coperto dalla tastiera, nessuno scroll orizzontale.
- Aprire una nuova segnalazione e toccare Foto: il selettore iOS deve offrire fotocamera/libreria; scattare o scegliere una foto, verificare anteprima e rimozione.
- Portare l'app in background e riaprirla: sessione e hotel devono restare coerenti.
- Disattivare rete, riaprire l'app e verificare shell disponibile; riattivare rete e verificare ripresa sync.
- Ricevere una notifica push/ntfy di prova e verificare apertura della destinazione corretta.
- Provare portrait e landscape, tema Light/Dark/System, UI Normal/Large.

## Android — Chrome + PWA installata

- Installare RandApp da Chrome e verificare nome/icona/standalone.
- Login: tastiera numerica PIN, nessun elemento coperto o tagliato.
- Nuova segnalazione: Foto deve permettere fotocamera o galleria; verificare anteprima/rimozione.
- Background/foreground: sessione e hotel invariati.
- Offline/reconnect: shell disponibile e ripresa sincronizzazione.
- Notifica push/ntfy di prova: tap apre la destinazione corretta.
- Portrait/landscape, Light/Dark/System, Normal/Large.

## Windows — Edge + Chrome

- Aprire RandApp in Edge e Chrome; installare la PWA almeno in Edge.
- Verificare nome/icona, avvio standalone e aggiornamento dopo refresh/deploy.
- Login e navigazione completa con mouse e tastiera.
- Nuova segnalazione: file picker immagini e anteprima.
- Import Housekeeping `.xls` con un file reale controllato.
- Offline/reconnect e ritorno online.
- Light/Dark/System e Small/Normal/Large.

## Criterio di accettazione

Ogni riga deve essere `OK` oppure produrre un bug riproducibile con: piattaforma, versione OS/browser, hotel selezionato, ruolo, passaggi, screenshot e comportamento atteso/reale. Nessun bug critico su autenticazione, isolamento hotel, salvataggio, foto, offline/reconnect, PWA o notifiche può essere accettato per una release.
