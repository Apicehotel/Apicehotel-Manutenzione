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

Ogni versione registra:

- prenotazione e hotel;
- numero versione;
- documento completo;
- autore;
- data/ora;
- motivo della modifica.

Il ripristino di una versione precedente **non riscrive né elimina la storia**: richiama una RPC controllata che salva quel documento come nuova versione attiva. Anche il restore usa `expectedVersion`, quindi un editor non può sovrascrivere silenziosamente modifiche concorrenti.

Gli utenti con sola visualizzazione/facchini vedono esclusivamente la versione attiva. Lo storico e il restore sono riservati ai permessi `planning_sale.edit/manage`.

## Regole invariabili

- Nessuna dipendenza CAD aggiuntiva per lo storico.
- Nessun secondo stato operativo per i facchini.
- Nessuna modifica diretta a prenotazioni, `roomKey`, `layoutKey` o PAX dal documento client.
- Nessun restore distruttivo: sempre nuova versione.
- RLS/RPC e hotel scope restano autoritativi.
- Nessun agente può portare queste modifiche direttamente su `main`; branch + PR + review umana.

## Prossimo passo

RandAI potrà proporre un allestimento da linguaggio naturale (es. "80 persone a platea, palco 4x2 e buffet vicino all'ingresso"), ma la proposta dovrà restare una bozza e passare dall'editor/approvazione prima di diventare versione attiva.
