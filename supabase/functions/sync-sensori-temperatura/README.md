# sync-sensori-temperatura (app unificata)

Edge function che legge le temperature da eWeLink e le salva nel DB unico,
associando ogni sensore al suo hotel tramite la mappa `DEVICE_HOTEL`.

## Stato attuale
La mappa `DEVICE_HOTEL` è **vuota**: i 9 sensori dell'account eWeLink condiviso
appartengono a **Hotel Giò**, che li gestisce nella sua app separata (non vanno
duplicati qui). Finché la mappa è vuota, la funzione risponde `{ok:true,
sensori:0}` senza contattare eWeLink — serve solo a non far fallire il pulsante
"Aggiorna" dell'app.

## Come aggiungere sensori (Chocohotel / Brigantino)
Quando installi sensori per un hotel dell'app unificata, aggiungi in `index.ts`
la riga nella mappa:
```
const DEVICE_HOTEL = {
  "10023abcd1": "chocohotel",
  "10023abcd2": "brigantino",
};
```
e ridistribuisci la funzione. I dati verranno salvati in `sensori_temperatura`
già separati per `hotel_id`.

## Deploy
Il codice vero è deployato sul progetto Supabase "Apice MultiHotel"
(ooqlfldcrnkudhgjnied). Questo file nel repo serve da traccia/riferimento.
Variabili d'ambiente richieste: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
