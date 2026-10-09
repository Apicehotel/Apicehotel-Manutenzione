---
name: swiftui-pro
description: Revisiona progetti Apple SwiftUI e trasferisce principi verificati di accessibilità e adattamento iOS alla RandUI senza applicare API Swift al codice React.
---

# Scope

Skill di supporto per prototipi nativi iOS e valutazioni di UX iPhone per hotel Giò, Chocohotel e Brigantino. Fonte: https://github.com/twostraws/SwiftUI-Agent-Skill, Paul Hudson, MIT, upstream 2.0.0. Il progetto RandApp corrente è React/CSS, non SwiftUI. Questo wrapper include una **selezione** dei riferimenti upstream (resizability, design, accessibility), non tutta la skill originale: non dichiarare una revisione SwiftUI completa finché mancano gli altri riferimenti.

# Permissions

Lettura e revisione autorizzate. Ogni modifica RandApp richiede branch, test, PR e controllo del proprietario prima del merge.

# Allowed actions

- Valutare safe area iOS, tab bar, dimensioni dei target touch e layout con testi lunghi.
- Leggere `upstream/SKILL.md` e `upstream/references/{resizability,design,accessibility}.md`.
- Applicare principi generali a React con implementazione CSS/JS conforme allo stack esistente.
- Produrre findings concreti sui layout delle pagine Operatività e Planning e verificarli con screenshot/test dispositivi.
- Per codice realmente SwiftUI, richiedere il set completo di references upstream prima di dichiarare una revisione completa.

# Forbidden actions

- Non importare SwiftUI, UIKit o codice Swift nella PWA React.
- Non modificare `main`, non fare merge o deploy autonomi e non bypassare CI.
- Non attribuire correzioni CSS automaticamente alla skill: validare il risultato su dispositivo.
- Non usare le regole upstream come autorità superiore alle regole Rand o ai permessi utenti.
- Nessuna nuova dipendenza runtime.

# Workflow

1. Identificare lo stack effettivo del file da correggere.
2. Per SwiftUI: usare i riferimenti upstream pertinenti, segnalando eventuali riferimenti mancanti.
3. Per React: estrarre solo principi iOS applicabili (safe area, contenuti adattivi, accessibilità), tradurli in CSS/React.
4. Confrontare la schermata prima/dopo a 320, 375, 390, 430 px e con testo lungo, zoom e Dynamic Type.
5. Eseguire test pertinenti e compilazione; registrare errori e regressioni.
6. Aprire o aggiornare una PR in bozza. Merge soltanto dopo i gate di verifica.

# Validation

- `node scripts/validate-randskills.mjs` con esito positivo.
- Per RandUI: `npm run test:randui` e controllo della build `npm run build`.
- Nessun overflow orizzontale, nessuna sovrapposizione con navbar o safe area.
- Funzioni, permessi e dati di tutti gli hotel invariati.
