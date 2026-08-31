# Contratto multi-hotel RandApp

## Principio

Hotel Giò, Chocohotel e Hotel Il Brigantino condividono le stesse funzioni generali. Le differenze sono ammesse solo quando rappresentano configurazione o realtà operative della singola struttura.

## Funzioni comuni

- Segnalazioni
- Interventi e I miei lavori
- Planning lavori
- Planning sale
- Housekeeping
- Avvisi urgenti
- Promemoria e notifiche
- Sensori e impianti
- Rubrica tecnici
- RandAI

La visibilità delle funzioni è determinata da ruolo e permessi, non dal nome dell'hotel.

## Configurazione per struttura

Possono differire camere, zone, sale, sensori installati, topic e recapiti di comunicazione, procedure locali e destinatari. Un valore non noto resta non configurato: non vengono creati dati fittizi per ottenere una falsa parità.

## Isolamento

Ogni dato operativo deve mantenere `hotel_id` lungo query, realtime, cache offline e scritture. Le autorizzazioni definitive sono server-side tramite RLS, membership e policy/RPC. RandAI eredita lo stesso contesto hotel e non può usare memoria o procedure di un'altra struttura senza un contratto esplicito che lo permetta.

## Gate

La suite include controlli per relazioni cross-hotel, cache/offline, query RandAI e parità delle funzioni frontend. Una futura eccezione deve essere esplicita, documentata e testata.