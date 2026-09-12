# CHANGE LOG: 005-randai-runtime-hitl-v1

## Changes
- 2026-09-12: inventariati autonomy engine, agents/coordinator, Action Gateway, RandSecure e DurableRuntime; nessun owner duplicato introdotto.
- 2026-09-12: CloddsBot classificato ADAPT patterns, MathModelAgent SOURCE_ONLY; nessuna nuova dipendenza runtime.
- 2026-09-12: introdotti canonical risk policy, HITL coordinator e sandbox fail-closed senza host execution.
- 2026-09-12: hardening fail-closed: RandHITLRuntime richiede autorizzazione canonica anche per READ_ONLY e non può diventare una scorciatoia attorno a Tool Gateway/Autonomy/RandSecure.
- 2026-09-12: README ed ecosystem manifest aggiornati senza introdurre RandAI2/Approval2/Sandbox2.
- 2026-09-12: commit `4609e0bfaa15d2f89303ba022f64bf483c66cc22` verificato verde su CI generale e RandAI Group 1–7, inclusi browser/device/RandCore health/LTS.
- 2026-09-12: closure RandSpec portata a `READY_FOR_HUMAN_REVIEW`; questo commit è il riferimento finale unico per il secondo pass completo CI + Group 1–7 prima della rimozione del draft.
