# Segnalazioni operative

## Autorita dati

La tabella canonica per le segnalazioni di manutenzione e `public.segnalazioni`. Housekeeping, WhatsApp, RandAI e gli altri moduli devono convergere su questo dominio invece di creare issue tracker paralleli.

`maintenance_issues` non viene eliminata automaticamente: prima di una rimozione va dimostrata l'assenza di dipendenze applicative, RandAI e migrazioni.

## Contesto strutturato

Le nuove segnalazioni possono registrare lo snapshot:

`hotel -> area -> piano -> camera -> modulo origine`

Campi opzionali:

- `location_mode`: `camera` o `zona`;
- `room_number`;
- `area_code`, `area_label`;
- `floor_number`, `floor_label`;
- `source_module`, `source_ref`.

I campi sono nullable per preservare segnalazioni storiche, zone e strutture senza una gerarchia piani configurata.

## Housekeeping

Dalla scheda di una camera, un utente con `issues:create` puo usare **Segnala problema**. Il form Segnalazioni viene aperto con camera e contesto operativo bloccati; l'utente completa problema, urgenza, categoria, stato camera e foto.

Per Hotel Gio il piano Housekeeping usa `hotel_floor_contexts`, la stessa fonte condivisa con Rifornimenti. La scelta viene persistita per utente e hotel tramite `src/operational-context.js`.

Il riferimento `source_ref` e uno snapshot logico, non una foreign key verso dati Housekeeping giornalieri: lo storico della segnalazione non deve rompersi quando cambia il planning del giorno.

## Offline e permessi

Il flusso esistente di `src/issues-data.js` resta invariato: cache, outbox, idempotenza `mutation_id`, foto offline e conflict detection continuano a essere usati. Il nuovo contesto viaggia nello stesso payload.

Il bottone Housekeeping e visibile solo quando la sezione Segnalazioni e disponibile e `canUser(user, 'issues', 'create')` e vero. Supabase RLS resta comunque l'autorita finale.
