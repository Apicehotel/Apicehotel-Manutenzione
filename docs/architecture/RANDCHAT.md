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

### Group B — implementato

4. **DM globali E2EE per dispositivo**
   - I DM sono globali tra utenti con `chat_enabled=true`; non richiedono appartenenza allo stesso hotel.
   - Ogni dispositivo crea due identità P-256: ECDH per la cifratura e ECDSA per la firma.
   - Le chiavi private sono re-importate come **non esportabili** e conservate esclusivamente nell'IndexedDB locale `randchatE2EE`.
   - Supabase conserva soltanto le chiavi pubbliche e metadata dei dispositivi.
   - Ogni messaggio usa una chiave AES-GCM 256 casuale e una chiave ECDH effimera.
   - La chiave contenuto viene cifrata separatamente per **ogni dispositivo attivo di entrambi i partecipanti**. Il server rifiuta l'invio se manca anche una sola envelope.
   - Il contenuto è firmato ECDSA/SHA-256; il client verifica la firma prima di restituire plaintext.
   - `chat_dm_messages` non possiede una colonna `body`: contiene solo ciphertext, IV, chiave pubblica effimera, firma e metadata.
   - Il server non riceve mai la chiave privata né il plaintext durante il normale invio/lettura del DM.

   **Limite dichiarato di E2EE v1:** non è un'implementazione Signal/Double Ratchet e non dichiara forward secrecy contro la successiva compromissione di una chiave privata dispositivo. La directory delle chiavi pubbliche è inoltre affidata al backend RandApp; una futura verifica device/pairing o un protocollo ratcheted può sostituire questo livello senza cambiare la UI RandChat.

   Un nuovo dispositivo non riceve retroattivamente le envelope dei messaggi già inviati: visualizza quindi `Messaggio precedente a questo dispositivo`. I nuovi messaggi vengono invece cifrati per tutti i dispositivi attivi registrati.

5. **Retention DM 1 / 7 / 15 giorni**
   - Ogni thread sceglie 1, 7 o 15 giorni.
   - `expires_at` è calcolato lato database; il client non può prolungare arbitrariamente la durata.
   - Se la policy cambia, viene ricalcolata anche la scadenza dei messaggi già presenti.
   - Cleanup automatico ogni ora via `pg_cron` elimina ciphertext ed envelope scadute per cascata.
   - Nessun body DM viene copiato nell'audit.

6. **Promozione Chat → Segnalazione persistente**
   - Un messaggio verificato può essere promosso esplicitamente a Segnalazione.
   - La stessa azione è disponibile anche sui gruppi operativi.
   - Nei DM, il testo viene decifrato nel browser e inviato al modulo Segnalazioni **solo dopo l'azione esplicita dell'utente**.
   - Da quel momento il testo scelto diventa deliberatamente dato operativo persistente della Segnalazione e segue permessi/retention del relativo modulo, non quelli della chat.
   - `chat_issue_links` conserva solo ID e metadata sorgente; non duplica plaintext né ciphertext.
   - Il link sopravvive alla retention della chat: gli ID messaggio sono `ON DELETE SET NULL`, mentre la Segnalazione resta valida.
   - La promozione richiede il permesso esistente `issues:create` e una camera/zona valida della struttura attiva.

## Separazione delle autorizzazioni

```text
hotel_memberships          chat_group_members          chat_dm_threads
       |                           |                          |
permessi RandApp         accesso al singolo gruppo      coppia utenti
       |                           |                          |
       +----------- X -------------+----------- X ------------+
```

Essere invitati in un gruppo del Chocohotel o parlare in DM con un utente Choco non concede accesso a segnalazioni, planning, magazzino o altri moduli Choco.

## Dati Group A

- `chat_groups`: gruppo, hotel ospitante, retention, creatore.
- `chat_group_members`: membership e ruolo interno.
- `chat_messages`: testo operativo del gruppo e stato pin.
- `profiles.chat_enabled`: abilitazione RandChat.
- `profiles.chat_can_create_groups`: capacità di creare gruppi.

## Dati Group B

- `chat_dm_devices`: chiavi **pubbliche** e lifecycle dei device E2EE.
- `chat_dm_threads`: coppia globale di utenti e retention 1/7/15.
- `chat_dm_messages`: ciphertext-only e metadata crittografici.
- `chat_dm_envelopes`: chiave contenuto cifrata per singolo device.
- `chat_issue_links`: collegamento metadata Chat → Segnalazione.
- IndexedDB locale `randchatE2EE`: chiavi private non esportabili del dispositivo.

## Realtime

Gruppi e DM usano Supabase Realtime solo dopo l'autorizzazione RLS/RPC. Per i DM Realtime notifica la presenza di nuovo ciphertext; la decifratura avviene esclusivamente nel client autorizzato.

## Roadmap successiva

### Group C

7. Canale di sistema **Inserimento procedure** → bozza Procedure.
8. RandAI sui gruppi operativi e sulle bozze Procedure; mai lettura automatica dei DM E2EE.
9. RandMedia con provider intercambiabile per foto, video, vocali e documenti.

### Future / opzionale

- Device verification / pairing e protocollo ratcheted per alzare ulteriormente il livello E2EE senza cambiare il modello utente RandApp.
- Telegram può essere aggiunto in seguito come provider RandMedia senza cambiare utenti, gruppi o UI RandChat.

## Principi invarianti

- Nessun account RandChat separato.
- DM e permessi hotel restano concetti separati.
- Membership cross-hotel non amplia mai i permessi operativi RandApp.
- Le chiavi private DM non vengono caricate su Supabase.
- Il normale percorso DM non invia plaintext al backend.
- Nessun audit deve conservare il corpo dei messaggi eliminati dalla retention.
- Dati operativi promossi (Segnalazioni/Procedure) vivono nel relativo modulo e non dipendono dalla durata della chat.
- Le garanzie crittografiche documentate devono corrispondere al protocollo realmente implementato; niente etichette "Signal-grade" senza Double Ratchet e verifica identità.
