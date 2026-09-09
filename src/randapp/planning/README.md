# Planning Sale / RandSale 2D

Planning Sale resta il dominio canonico per prenotazione, hotel, sala, configurazione, PAX e stato operativo. RandSale 2D non crea un secondo Planning: aggiunge una rappresentazione renderer-independent dell'allestimento collegata alla prenotazione esistente.

## Punti 3–5

- `sale_layout_snapshots` conserva la versione attiva della pianta per prenotazione.
- Il documento usa centimetri e `schemaVersion`, quindi SVG è solo un renderer e può essere sostituito in futuro.
- `roomKey`, `layoutKey`, nome sala/configurazione e PAX vengono riagganciati lato server alla prenotazione canonica.
- L'editor è riservato a `planning_sale.edit/manage`.
- La modalità facchini è sola lettura e continua a usare `Fatto / Da finire` dalla card Planning esistente.
- Il salvataggio usa optimistic concurrency tramite `expectedVersion`.

## Punto 6 — storico versioni

Lo storico è append-only in `sale_layout_snapshot_history`.

Ogni versione registra prenotazione/hotel, numero versione, documento completo, autore, data/ora e motivo della modifica.

Il ripristino di una versione precedente **non riscrive né elimina la storia**: richiama una RPC controllata che salva quel documento come nuova versione attiva. Anche il restore usa `expectedVersion`, quindi un editor non può sovrascrivere silenziosamente modifiche concorrenti.

Gli utenti con sola visualizzazione/facchini vedono esclusivamente la versione attiva. Lo storico e il restore sono riservati ai permessi `planning_sale.edit/manage`.

## Punto 7 — proposta RandAI

`src/randsale2d-ai-proposal.js` definisce il contratto governato per trasformare una richiesta in linguaggio naturale in una bozza renderer-independent.

Esempio:

`80 persone a platea, palco 4x2 sul fondo, tavolo relatori, buffet vicino ingresso e passaggio centrale`

produce un documento 2D in centimetri con elementi riconoscibili e metadati Planning già agganciati alla prenotazione.

Regole:

- la proposta nasce sempre con `status=DRAFT` e `authority=HUMAN_APPROVAL_REQUIRED`;
- non chiama Supabase, non salva snapshot e non modifica prenotazioni;
- l'operatore vede un'anteprima e deve scegliere esplicitamente `Usa questa bozza nell'editor`;
- dopo l'accettazione la bozza diventa normale contenuto dell'editor e può essere modificata manualmente;
- solo il normale pulsante `Salva pianta` crea una nuova versione nello storico;
- la proposta non certifica capienza, vie di fuga o conformità antincendio;
- nessuna nuova dipendenza o secondo AI runtime: il contratto è predisposto per essere alimentato dal RandAI canonico in futuro, mantenendo lo stesso boundary umano.

## Regole invariabili

- Nessuna dipendenza CAD aggiuntiva.
- Nessun secondo stato operativo per i facchini.
- Nessuna modifica diretta a prenotazioni, `roomKey`, `layoutKey` o PAX dal documento client.
- Nessun restore distruttivo: sempre nuova versione.
- Nessuna proposta RandAI può auto-applicarsi o auto-salvarsi.
- RLS/RPC e hotel scope restano autoritativi.
- Nessun agente può portare queste modifiche direttamente su `main`; branch + PR + review umana.

## Stato roadmap RandSale 2D

I 7 punti core sono coperti: modello renderer-independent, persistenza/snapshot, editor mobile, modalità facchini, integrazione Planning, storico/versioni e proposta RandAI governata.

Le evoluzioni successive sono opzionali e non bloccano il core: template avanzati, validazioni geometriche/capienza più sofisticate e, solo se davvero utile, adapter 2.5D/3D.
