# Plan

1. Aggiungere primitive RandCapabilityRouter e provider contract in RandCore.
2. Aggiungere adapter RandGateway come provider di operational.action.
3. Collegare Action Gateway al router preservando il percorso RLS/HITL/audit.
4. Esportare le primitive dal core.
5. Aggiungere test per routing, preflight, fail-closed, fallback sicuro e health.
6. Aggiornare README e architettura.
7. Aprire PR e usare CI come gate autorevole.
