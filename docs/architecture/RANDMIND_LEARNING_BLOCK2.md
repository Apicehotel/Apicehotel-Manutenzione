# RandMind Cognitive + Learning — Blocco 2

Il Blocco 2 collega sistemi già esistenti invece di introdurre un secondo framework agentico.

## Prima del blocco

RandApp possedeva già:

- `src/randai/agents/*`: runtime, orchestrazione, registry e coordinatore multi-agent;
- `src/randai/tools/*`: ToolRegistry e permission gateway;
- `src/randai/memory/*`: RandMind, continuity, store e production gate;
- `src/randai/learning/*`: LearningEngine con evidenze verificate, candidate skill, evaluation e approval;
- `src/randai/skills/*`: SkillRegistry/SkillEngine interni.

Per questo Hermes Agent e Ruflo restano donatori architetturali: importarli integralmente avrebbe duplicato runtime, memory, tools e orchestrazione.

## Dopo il blocco

Flusso canonico:

`RandAI -> RandMindCognitiveLoop -> RandSkills -> Tool visibility -> RandAgentRuntime -> inspection/continuity -> LearningEngine`

### RandSkills bridge

`src/randai/skills/canonical.js` registra nel `SkillRegistry` esistente le sette skill create nel Blocco 1. Il file `rand-skills/<id>/SKILL.md` resta la sorgente documentale governata; il catalogo runtime non introduce un secondo registry.

### Tool visibility

`ToolsetResolver` non concede permessi. Riceve la lista di tool già autorizzati dal livello superiore e applica un ulteriore limite di rischio. Il risultato è quindi sempre un sottoinsieme dell'autorizzazione esistente.

### Cognitive loop

`RandMindCognitiveLoop` richiede sempre `hotelId`, seleziona solo skill `APPROVED`, espone al runtime soltanto tool autorizzati e bounded, e delega l'esecuzione al `RandAgentRuntime` già esistente. Non esiste un secondo executor.

### Learning

L'apprendimento avviene solo dopo un run riuscito e soltanto quando viene fornita un'osservazione verificata. `LearningEngine` continua a richiedere evidenze multiple prima di creare una candidate skill.

`learningPromotionDecision` distingue:

- `AUTO`: solo miglioramento LOW risk, testato, con >=2 evidenze verificate;
- `REVIEW`: MEDIUM/HIGH/CRITICAL oppure modifiche a autorizzazione, schema o operazioni distruttive;
- `BLOCKED`: non testato o senza evidenza sufficiente.

Regola invariabile: **RandMind può imparare da solo, ma non può cambiare da solo i confini critici di RandCore.**

## Zombie scan

Nessun subsystem preesistente è stato rimosso perché agent runtime, memory, learning, tool registry e skill registry sono tutti vivi e coperti da test. Il blocco elimina una duplicazione futura: vieta l'introduzione di un secondo framework Hermes/Ruflo in parallelo.

## Gate

```bash
npm run skills:validate
npm run test:randskills
npm run test:mind-learning
npm run test:randmind
npm run test:learning
npm test
npm run build
```
