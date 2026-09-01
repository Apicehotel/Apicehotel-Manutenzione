# RandApp App Shell Foundation

## Obiettivo

Il Punto 1 consolida la chrome condivisa di RandApp senza cambiare la logica dei domini operativi. L'obiettivo è avere una sola geometria prevedibile su iOS PWA, Android web/PWA e Windows, già pronta a ricevere in futuro inset nativi da un wrapper Android (per esempio Capacitor) senza riscrivere i componenti React.

## Contratto navigazione mobile

La bottom navigation ha cinque slot strutturali:

1. Segnalazioni
2. Interventi
3. Home
4. Planning
5. Menu

`Home` è quindi sempre lo slot centrale. Ruoli e permessi possono disabilitare una destinazione, ma non riordinano gli altri slot. Una destinazione non autorizzata lascia libero il proprio slot invece di spostare Home o trasformare il layout.

Il pulsante `+` non è una sesta destinazione: resta un'azione contestuale che apre `InsertLauncher`. È ancorato sopra la bottom navigation e calcola la posizione rispetto all'inset di sistema effettivo.

Il contratto è definito in `src/randapp/shell-navigation.js` ed è collegato da `Shell.jsx`.

## Safe area e system navigation

`src/randapp/app-shell-foundation.css` definisce gli inset effettivi come massimo tra:

- CSS `env(safe-area-inset-*)` forniti dal browser/PWA;
- `--rs-native-safe-*`, inizialmente a zero e aggiornabili da un futuro host nativo.

Non viene applicato alcun limite massimo arbitrario all'inset inferiore. Questo è intenzionale: Home Indicator iOS, gesture bar Android, navigazione Android a tre tasti e future `WindowInsets` native devono poter riservare tutto lo spazio necessario.

`src/randapp/system-insets.js` espone il bridge. Un futuro wrapper può impostare `window.__RANDAPP_NATIVE_INSETS__` prima del mount oppure emettere:

```js
window.dispatchEvent(new CustomEvent('randapp-system-insets', {
  detail: { top: 24, right: 0, bottom: 48, left: 0 },
}))
```

I valori sono pixel CSS non negativi.

## Responsive

- mobile e tablet mantengono la bottom navigation;
- Windows/desktop continua a usare la sidebar esistente da 960px in su;
- la modalità Grande continua a usare `--rs-scale` e token condivisi senza cambiare l'ordine della navigazione;
- `viewport-fit=cover` resta obbligatorio in `index.html`.

## Scelte tecnologiche

Non sono state aggiunte dipendenze UI o native nel Punto 1. Konsta UI, Material 3 e i cataloghi 21st.dev restano riferimenti per pattern e componenti del Punto 2; introdurli durante il consolidamento dello shell avrebbe aumentato il rischio di regressioni senza un vantaggio strutturale.

Capacitor non viene aggiunto ora. Il bridge inset consente però a un futuro APK Android di collegare `WindowInsets` allo stesso contratto CSS senza duplicare il layout.

## Gate

`test/ui-shell-foundation.test.js` protegge:

- i cinque slot e Home centrale;
- stabilità degli slot quando un permesso disabilita una destinazione;
- assenza di cap sull'inset inferiore nel nuovo layer finale;
- bridge degli inset nativi;
- wiring dello Shell e `viewport-fit=cover`.

Prima del merge restano obbligatori i gate generali del repository: build, suite Node, quality matrix/critical gate e verifiche multipiattaforma previste dalla CI.
