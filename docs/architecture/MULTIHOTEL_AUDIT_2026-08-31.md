# Audit multi-hotel — 31 agosto 2026

## Esito

L'audit del Consolidamento 5 ha verificato la parità funzionale frontend e l'isolamento backend tra Hotel Giò, Chocohotel e Hotel Il Brigantino.

## Correzione funzionale

Planning Sale era limitato nel frontend da un controllo esplicito su `hotelgio`. Il backend era già multi-hotel: `prenotazioni_sale`, `sale_clients`, `sale_layouts_config` e `sale_rooms_config` possiedono `hotel_id` e RLS. Il blocco frontend è stato rimosso: l'accesso ora dipende solo dal permesso `planning_sale`.

Choco e Brigantino non ricevono sale inventate. La configurazione sale può essere popolata per struttura dalla UI autorizzata.

## Housekeeping

Il runtime è comune alle tre strutture, con cataloghi camera/zona separati, IndexedDB per hotel, query con `hotel_id` e realtime filtrato per hotel. Le regole specifiche di Hotel Giò non vengono propagate agli altri hotel.

## Integrazioni

I topic ntfy risultano configurati per tutte e tre le strutture. WhatsApp/Twilio resta configurabile per hotel: al momento la configurazione nota contiene un recapito per Hotel Giò mentre Choco e Brigantino sono dichiarati esplicitamente senza numero, evitando dati fittizi.

## Backend

Le principali tabelle operative verificate hanno RLS attiva: manutenzioni/segnalazioni, interventi, planning lavori, planning sale, housekeeping, urgenti, promemoria, tecnici, push e domini RandAI. I gate relazionali già presenti continuano a verificare ownership hotel, relazioni child-parent cross-hotel, cache offline e query RandAI.

## Contratto permanente

I test `consolidation-point5-multihotel-parity.test.js` e `consolidation-point5-backend-contract.test.js`, insieme ai gate multi-hotel esistenti, impediscono il ritorno di restrizioni frontend specifiche di Giò o la perdita del contesto hotel nei flussi principali.