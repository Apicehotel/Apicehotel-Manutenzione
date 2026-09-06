# Group 3 executor decision

Decisione: non installare Trigger.dev, Inngest, Mastra o LangGraph nel PWA in questo blocco.

Motivo: il repository possiede già orchestrator sincrono, recovery engine, RandBrain/RandSkills e scheduler governati. Aggiungere un framework come proprietario concorrente creerebbe overlap. Il contratto `RandDurableRuntime` separa la semantica Rand dall'infrastruttura.

Quando serve vera persistenza/queue server-side, Trigger.dev è il primo adapter da valutare per workflow TypeScript lunghi/costosi; l'adozione richiede benchmark, security/cost gate e workload concreto. Inngest resta alternativa; Mastra è eventualmente agent engine, non durable authority; LangGraph resta reference.
