# RandChat viewport contract

RandChat è un workspace interno della shell RandUI e usa un'architettura composta, non una pagina standard.

## Runtime

- `RandChat.jsx`: orchestrazione dati e permessi.
- `RandChatList.jsx`: lista Gruppi / Diretti.
- `RandChatThread.jsx`: conversazione e input panel.
- `useRandChatScroll.js`: auto-scroll, detach e ritorno agli ultimi.
- `randchat.css`: layout unico.
- `rs-content--chat`: viewport centrale dedicato della shell.

## Mobile

Quando nessuna conversazione è aperta viene mostrata la lista.

Quando un thread è aperto, la lista viene sostituita da:

`header → avvisi → messaggi scrollabili → composer`

Solo la cronologia messaggi scorre. Il composer è una riga fisica del thread e resta sopra la bottom navigation.

## Desktop

RandChat usa una split view:

`lista conversazioni | thread`

La lista e il thread possiedono ciascuno il proprio scroll interno.

## Scroll

Il comportamento segue il modello usato come riferimento da NextChat e Telegram X:

- il thread aperto parte dall'area più recente;
- se l'utente è al fondo, i nuovi messaggi vengono seguiti;
- se risale nello storico, l'auto-scroll si disattiva;
- compare il comando per tornare agli ultimi messaggi;
- l'invio riaggancia il fondo.

## Composer

- textarea auto-grow fino al limite previsto;
- Enter invia;
- Shift+Enter va a capo;
- composizione IME/Safari non viene interpretata come invio;
- allegati integrati nello stesso input panel.

RandChat è per uso interno/non commerciale. NextChat è un riferimento React/layout con licenza MIT; Telegram X resta un riferimento comportamentale mobile. Il codice RandChat è implementazione RandUI originale.


## Comandi e mention

Nel composer dei gruppi:

- `@procedura` apre il selettore Procedure;
- `@randai` apre RandAI;
- `@membri` apre la gestione membri;
- `@Nome_Membro` inserisce una mention membro.

Digitando `@` compare un picker contestuale sopra il composer. I tag inviati vengono evidenziati nelle bolle.

Il menu `⋯` globale della testata conversazione è stato rimosso. I `⋯` sui singoli messaggi restano per le azioni contestuali.
