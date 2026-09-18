# RandChat single-screen viewport contract

RandChat usa un runtime unico e sostitutivo.

## Runtime corrente

- `RandChat.jsx` contiene lista conversazioni, thread, invio, Gruppi e Diretti.
- `randchat-next.css` contiene l'intero layout chat.
- La vecchia UI è stata cancellata.

## Contratto mobile

Quando nessun thread è aperto, RandChat mostra la lista conversazioni e i tab Gruppi / Diretti.

Quando un thread è aperto:

1. header conversazione;
2. area messaggi scrollabile;
3. composer sempre presente in fondo.

Solo la cronologia messaggi scorre. Il composer non usa un posizionamento fixed/absolute rispetto al browser: è una riga fisica del layout del thread e quindi resta nello spazio RandUI sopra la bottom navigation.

L'apertura del thread parte dagli ultimi messaggi disponibili. Se l'utente è vicino al fondo, i nuovi messaggi vengono seguiti automaticamente; se sta leggendo lo storico, viene preservata la posizione e viene mostrato il comando per tornare agli ultimi messaggi.

Telegram X è un riferimento comportamentale. Nessun suo codice GPL viene incorporato nel runtime RandChat.
