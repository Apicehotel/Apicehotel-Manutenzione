# RandDesktop — stampa nativa

RandDesktop è il guscio Windows/Desktop di RandApp. Non duplica RandApp, Supabase, permessi o dati operativi.

## Obiettivo

La stampa v1 usa le API native Electron mantenendo il renderer web isolato:

`RandApp → preload ristretto → IPC nominato → main Electron → webContents.print()`

Sono supportati:

- `File → Stampa…` / `Ctrl+P` sulla vista corrente;
- elenco stampanti installate tramite `webContents.getPrintersAsync()`;
- stampa di documenti strutturati in una finestra nascosta sandbox;
- dialog nativo del sistema operativo;
- pagina predefinita della stampante (`usePrinterDefaultPageSize: true`);
- sfondi di stampa dove presenti.

## Sicurezza

La stampa non deve trasformare Electron in una seconda superficie privilegiata.

Invarianti v1:

- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- `webSecurity: true`;
- il renderer non riceve `ipcRenderer` grezzo;
- ogni handler IPC verifica che il sender sia il `webContents` della finestra RandDesktop;
- il renderer non può inviare HTML arbitrario da stampare;
- i documenti strutturati vengono normalizzati, limitati ed escape-ati nel main process;
- il template di stampa usa una CSP `default-src 'none'`;
- nessuna stampa silenziosa in v1;
- nessun `deviceName` scelto dal renderer in v1;
- nessun secret, token Supabase o service role viene aggiunto al desktop.

La stampa silenziosa può essere introdotta solo in seguito dietro una preferenza amministrativa esplicita e con una stampante autorizzata server/configuration-side.

## Vista corrente

Quando è aperto un `Sheet` operativo (per esempio dettaglio Segnalazione), il CSS di stampa privilegia quel pannello e nasconde la cornice circostante. In assenza di Sheet viene stampata la vista corrente.

Questo consente un primo flusso utile senza duplicare le schermate React.

## Documenti strutturati

Il bridge `window.randDesktop.print.document()` accetta solo un payload dati:

```js
{
  title: 'Segnalazione Camera 214',
  subtitle: 'Hotel Giò',
  metadata: [
    { label: 'Urgenza', value: 'Media' },
    { label: 'Categoria', value: 'Elettrica' }
  ],
  sections: [
    {
      heading: 'Problema',
      text: 'Lampadina bagno fulminata'
    }
  ],
  footer: 'RandApp'
}
```

Non viene accettato HTML libero. Il renderer può quindi creare in futuro template applicativi per Segnalazioni, Planning, Rifornimenti, Housekeeping e RandChat senza aumentare i privilegi Electron.

## Stampanti

`window.randDesktop.print.listPrinters()` restituisce soltanto:

- `name` tecnico;
- `displayName`;
- `description`;
- `status`;
- `isDefault`.

Le opzioni complete del driver non vengono esposte al renderer.

## Avvio sviluppo

RandDesktop è separato dalle dipendenze web principali per non appesantire Vercel/CI web.

```bash
# terminale 1 — root RandApp
npm run dev

# terminale 2
cd desktop
npm install
npm start
```

In sviluppo viene caricata `RANDAPP_DEV_URL`, con fallback `http://localhost:5173`.

In una build pacchettizzata RandDesktop carica solo il renderer locale da:

`process.resourcesPath/app/index.html`

Non carica Vercel come renderer privilegiato di produzione.

## Stato v1

Implementato:

1. shell Electron sicura;
2. preload ristretto;
3. stampa vista corrente con dialog;
4. elenco stampanti;
5. motore documenti strutturati;
6. escape/CSP;
7. test di contratto.

Non ancora incluso in v1:

- stampa silenziosa;
- scelta persistente stampante;
- PDF/save dialog;
- code di stampa;
- telemetria RandCore delle stampe;
- template specifici per ogni modulo;
- packaging/installer firmato.
