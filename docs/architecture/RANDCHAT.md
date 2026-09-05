# RandChat

RandChat è il modulo di messaggistica interno di RandApp. Riusa identità, hotel e autorizzazione già esistenti: non introduce un secondo account utente.

## Stato

### Group A — implementato

1. **Abilitazione per utente**
   - `profiles.chat_enabled`: ON/OFF gestito dall'amministrazione.
   - `profiles.chat_can_create_groups`: capacità separata per creare gruppi.
   - L'utente non può auto-abilitarsi modificando direttamente `profiles`.
   - RandChat compare in navigazione solo se `chat_enabled = true`.

2. **Gruppi operativi**
   - I gruppi appartengono a un hotel ospitante (`chat_groups.hotel_id`).
   - Ruoli del gruppo: `owner`, `admin`, `member`.
   - Un admin del gruppo può invitare un utente RandChat di un altro hotel.
   - La membership cross-hotel è **solo chat** e non crea/modifica `hotel_memberships`.
   - Directory inviti minimale: `auth_user_id`, nome visualizzato e hotel; email e telefono non sono esposti.
   - I gruppi sono operativi aziendali, quindi non E2EE. Sono protetti da autenticazione, RLS e membership.

3. **Retention gruppi**
   - Policy per gruppo: 30 o 60 giorni.
   - Cleanup automatico giornaliero con `pg_cron`.
   - I messaggi fissati/conservati (`pinned_at`) non vengono cancellati.
   - L'audit del cleanup registra solo conteggio e policy, mai il testo eliminato.

## Separazione delle autorizzazioni

```text
hotel_memberships          chat_group_members
       |                           |
permessi RandApp         accesso al singolo gruppo
       |                           |
       +----------- X -------------+
```

Essere invitati in un gruppo del Chocohotel non concede accesso a segnalazioni, planning, magazzino o altri moduli Choco.

## Dati Group A

- `chat_groups`: gruppo, hotel ospitante, retention, creatore.
- `chat_group_members`: membership e ruolo interno.
- `chat_messages`: testo operativo del gruppo e stato pin.
- `profiles.chat_enabled`: abilitazione RandChat.
- `profiles.chat_can_create_groups`: capacità di creare gruppi.

Le tre tabelle chat sono pubblicate su `supabase_realtime` e protette da RLS.

## Realtime

Il client usa Supabase Realtime solo dopo che RLS ha verificato la membership. Il server resta l'autorità: nascondere una voce di menu non costituisce autorizzazione.

## Roadmap successiva

### Group B

4. DM globali tra utenti RandChat con E2EE.
5. Retention DM 1 / 7 / 15 giorni.
6. Promozione esplicita da DM/gruppo a Segnalazione persistente.

### Group C

7. Canale di sistema **Inserimento procedure** → bozza Procedure.
8. RandAI sui gruppi operativi e sulle bozze Procedure; mai lettura automatica dei DM E2EE.
9. RandMedia con provider intercambiabile per foto, video, vocali e documenti.

### Future / opzionale

Telegram può essere aggiunto in seguito come provider RandMedia senza cambiare utenti, gruppi o UI RandChat.

## Principi invarianti

- Nessun account RandChat separato.
- DM e permessi hotel restano concetti separati.
- Membership cross-hotel non amplia mai i permessi operativi RandApp.
- Nessun audit deve conservare il corpo dei messaggi eliminati dalla retention.
- Dati operativi promossi (Segnalazioni/Procedure) vivono nel relativo modulo, non dipendono dalla durata della chat.
