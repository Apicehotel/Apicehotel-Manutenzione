# RandUI audit 2026-09-08

Stato consolidato della revisione UI avviata dai test iPhone.

## Regole
- tutte le 24 pagine devono passare dal catalogo RandUI;
- bottom navigation = navigazione, mai creazione;
- `+` = creazione contestuale della pagina attiva;
- test grafici esclusivamente su DigitalOcean/Ocean;
- nessuna modifica grafica viene promossa direttamente su Vercel/main;
- niente secondo design system: PageBoundary, template, Foundation e component registry restano canonici.

## Classificazione
- **KEEP**: `plants`, `desktop-download`;
- **REBUILD**: `temperature` (priorità critica);
- **UNIFY**: le restanti 21 pagine, mantenendo workflow e logica ma allineando gabbia, spazi, densità e azioni.

## Correzioni già incluse
- bottom bar: Operatività · Planning · Home · Task · RandAI per ruoli autorizzati;
- Planning non apre più una creazione residua;
- Interventi `+` → Nuovo intervento;
- Planning lavori `+` → Nuovo lavoro;
- Planning sale `+` → Nuova attività sala;
- bridge legacy Planning→intervento rimosso;
- `layout-contract.js` e `layout-v2.css` introducono gabbia misurabile senza riscrivere le pagine;
- Sensori usa riepilogo, priorità anomalie, stati espliciti e griglia responsive;
- Impianti resta invariato come riferimento valido;
- `digitalocean-preview.yml` valida il PR head e lo porta su Ocean dopo i gate automatici.

## Vincoli futuri
Lo slot “Adesso” può entrare nelle pagine operative solo quando alimentato da dati reali già autorizzati. Non va usato come decorazione per riempire spazio. Le pagine senza contenuto utile devono comprimersi invece di mantenere altezze vuote.
