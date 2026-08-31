# Matrice parità funzionale multi-hotel

| Funzione | Hotel Giò | Chocohotel | Brigantino | Isolamento |
| --- | --- | --- | --- | --- |
| Segnalazioni | sì | sì | sì | `hotel_id` + RLS |
| Interventi | sì | sì | sì | `hotel_id` + RLS |
| Planning lavori | sì | sì | sì | `hotel_id` + RLS |
| Planning sale | sì | sì | sì | `hotel_id` + RLS |
| Housekeeping | sì | sì | sì | `hotel_id`, cache per hotel, RLS |
| Urgenti | sì | sì | sì | `hotel_id` + RLS |
| Promemoria | sì | sì | sì | `hotel_id` + RLS |
| Push / ntfy | sì | sì | sì | topic/subscription per hotel |
| Sensori / impianti | sì | sì | sì | configurazione per struttura |
| Rubrica tecnici | sì | sì | sì | `hotel_id` + RLS |
| RandAI | sì | sì | sì | contesto/query per hotel |

“sì” indica disponibilità della funzione quando il ruolo possiede i relativi permessi. Non significa che ogni struttura debba avere gli stessi dati configurati. Sale, camere, sensori, numeri WhatsApp e procedure locali rimangono indipendenti.