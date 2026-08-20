# Report automatici Apicehotel

Lo script `report-sync.gs` aggiorna i report di Hotel Giò, ChocoHotel e Hotel Il Brigantino usando `hotel_id`. Include segnalazioni, interventi, camere bloccate, avvisi urgenti e Planning lavori; Planning Sale è previsto solo per Hotel Giò.

## Configurazione Apps Script

1. Creare un progetto Apps Script centrale e incollare `report-sync.gs`.
2. In **Impostazioni progetto → Proprietà script**, aggiungere:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REPORT_SYNC_ENABLED` = `false` durante le prove
3. Solo al passaggio in produzione impostare `REPORT_SYNC_ENABLED` = `true`.
4. Eseguire una volta `syncAllReports` e autorizzare l’accesso ai fogli.
5. Eseguire una volta `installAutomaticTrigger` per l’aggiornamento ogni 15 minuti.
6. Facoltativo: distribuire `doGet` come applicazione web per consentire un aggiornamento immediato dopo una modifica nell’app.

La service role key non deve essere inserita nel repository, nei fogli o nel frontend.
