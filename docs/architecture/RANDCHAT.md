# RandChat

RandChat è il modulo di messaggistica interno di RandApp. Riusa identità, hotel e autorizzazione già esistenti: non introduce un secondo account utente.

## Stato

Il core RandChat è completato **9/9** nei Group A, B e C.

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

### Group C — implementato

7. **Procedure / Inserimento procedure**
   - Una procedura RandGuide `approved` può essere condivisa in un gruppo operativo.
   - La condivisione crea un normale messaggio gruppo e `chat_procedure_links` conserva **snapshot + versione** della procedura, così lo storico non cambia se la procedura viene aggiornata in seguito.
   - Per sfogliare il catalogo Procedure servono contemporaneamente membership del gruppo e membership reale dell'hotel ospitante.
   - Un invitato cross-hotel può leggere lo snapshot esplicitamente condiviso nel gruppo, ma non ottiene accesso al catalogo RandGuide dell'altro hotel.
   - Un messaggio operativo può essere trasformato in una bozza canonica `randai_procedures` usando l'authoring RandGuide già esistente.
   - La bozza nasce con `status='draft'`, confidence 70 e source label `Bozza da RandChat · revisione umana obbligatoria`.
   - Il percorso chat **non possiede alcuna funzione di approvazione/pubblicazione**: la revisione umana RandGuide resta obbligatoria.
   - La creazione bozza è auditata con ID gruppo/messaggio e `requires_approval=true`, senza creare un secondo archivio Procedure.

8. **RandAI sui gruppi autorizzati**
   - RandAI non osserva automaticamente tutti i messaggi e non parte a ogni evento: l'utente usa esplicitamente `Chiedi a RandAI`, evitando costo e rumore permanenti.
   - `chat_group_ai_context` limita il contesto agli ultimi messaggi necessari e ai riferimenti Procedure/Segnalazioni già autorizzati.
   - L'accesso richiede **sia membership del gruppo sia membership dell'hotel ospitante**. Essere soltanto invitati cross-hotel al gruppo non consente di usare RandAI per esplorare dati operativi di quell'hotel.
   - Il bridge riusa `retrieveRandAIGuidance` e la Edge Function `randai-assistant`: nessun secondo motore IA.
   - I **DM E2EE non sono inclusi** nel bridge RandAI e non vengono letti automaticamente dal server/modello.

9. **RandMedia**
   - Esiste un solo contratto provider (`getRandMediaProvider`). Il provider operativo iniziale è Supabase Storage privato `randchat-media`.
   - Telegram resta un adapter futuro opzionale: aggiungerlo non richiede modifiche al modello utenti, alle tabelle chat o alla UI.
   - Massimo 4 allegati per messaggio, 20 MiB ciascuno lato utente.
   - Nei gruppi i media sono dati operativi plaintext protetti da RLS/membership e signed URL brevi.
   - Nei DM il file viene cifrato AES-GCM 256 **prima dell'upload**; lo storage riceve solo `application/octet-stream` cifrato.
   - Nome, MIME originale, chiave file e IV vivono nel payload DM v2 già protetto dall'E2EE Group B. Le tabelle server DM conservano soltanto path/size e flag `encrypted=true`.
   - Il decoder resta compatibile con i DM Group B v1 già esistenti.
   - Il send RPC v2 richiama il sender Group B già testato e registra gli allegati nella stessa transazione DB.
   - `chat_attachments` viene eliminata per cascata quando il messaggio scompare; un trigger mette il relativo oggetto in `chat_media_gc_queue`.
   - `randchat-media-cleanup` elimina provider objects in coda e cerca anche upload orfani più vecchi di due ore.
   - Il worker gira ogni ora al minuto 25. Nessun file cancellato dalla chat deve restare indefinitamente come media zombie.

## Separazione delle autorizzazioni

```text
hotel_memberships          chat_group_members          chat_dm_threads
       |                           |                          |
permessi RandApp         accesso al singolo gruppo      coppia utenti
       |                           |                          |
       +----------- X -------------+----------- X ------------+
```

Essere invitati in un gruppo del Chocohotel o parlare in DM con un utente Choco non concede accesso a segnalazioni, planning, magazzino o altri moduli Choco.

Group C mantiene la stessa separazione: uno snapshot Procedure esplicitamente condiviso è contenuto del gruppo; non equivale a membership hotel. RandAI e catalogo Procedure richiedono invece membership hotel effettiva.

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

## Dati Group C

- `chat_procedure_links`: snapshot/versione delle procedure approvate condivise nel gruppo.
- `randai_procedures`: resta la **sola** fonte Procedure; le bozze provenienti da RandChat entrano qui come `draft`.
- `chat_attachments`: metadata provider degli allegati; nei DM non contiene nome/MIME/chiave originale.
- `chat_media_gc_queue`: coda server-only di rimozione storage.
- Storage privato `randchat-media`: media gruppi plaintext autorizzati e blob DM cifrati.

## Realtime e workers

Gruppi e DM usano Supabase Realtime solo dopo l'autorizzazione RLS/RPC. Per i DM Realtime notifica la presenza di nuovo ciphertext; la decifratura avviene esclusivamente nel client autorizzato.

Workers RandChat:

- `randchat-group-retention`: retention gruppi 30/60 giorni;
- `randchat-dm-retention-hourly`: retention DM 1/7/15 giorni;
- `randchat-media-gc-hourly`: pulizia oggetti media cancellati/orfani.

## Future / opzionale

Questi punti **non fanno parte dei 9 blocchi core mancanti**:

- device verification/pairing e protocollo ratcheted per alzare ulteriormente il livello E2EE;
- adapter Telegram RandMedia per media operativi, mantenendo Supabase o altro provider come fallback;
- registrazione audio in-app dedicata: oggi RandMedia accetta file audio, ma la policy browser corrente non abilita automaticamente il microfono.

## Principi invarianti

- Nessun account RandChat separato.
- DM e permessi hotel restano concetti separati.
- Membership cross-hotel non amplia mai i permessi operativi RandApp.
- Le chiavi private DM non vengono caricate su Supabase.
- Testo e allegati DM non arrivano plaintext allo storage/backend nel normale percorso.
- Nessun audit deve conservare il corpo dei messaggi eliminati dalla retention.
- Dati operativi promossi (Segnalazioni/Procedure) vivono nel relativo modulo e non dipendono dalla durata della chat.
- Una bozza Procedure proveniente da RandChat non può diventare approved senza il normale gate RandGuide.
- RandAI non riceve automaticamente DM E2EE.
- Il provider media è intercambiabile; la UI non dipende da API Telegram/Supabase specifiche.
- Le garanzie crittografiche documentate devono corrispondere al protocollo realmente implementato; niente etichette "Signal-grade" senza Double Ratchet e verifica identità.
