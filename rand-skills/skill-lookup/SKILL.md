---
name: skill-lookup
description: Cerca Agent Skills nel registry prompts.chat e le tratta come candidate governate da valutare prima di qualsiasi importazione nel catalogo RandSkills.
---

# Scope

Usa prompts.chat per scoprire skill esterne riutilizzabili. La skill integra Repo Radar e RandSkills: prompts.chat è una fonte di discovery, RandCore resta l'autorità. Ogni candidata deve essere valutata anche rispetto allo scope hotel e ai confini tra strutture.

# Permissions

Lettura del catalogo e recupero dei file delle skill candidate. L'installazione richiede import controllato, validazione SKILL.md, test e review.

# Allowed actions

- Cercare skill per query, categoria e tag.
- Recuperare SKILL.md, documentazione e file associati.
- Valutare sovrapposizione con skill Rand già esistenti.
- Proporre AGGIUNGI, SOSTITUISCI, IGNORA o FONTE.
- Importare su branch solo dopo verifica della struttura e della governance.

# Forbidden actions

- Nessuna auto-installazione in produzione.
- Nessuna skill esterna può sostituire permessi o autorità Rand.
- Nessuna installazione dalla root di un repository senza discovery ricorsiva dei manifest.
- Nessun file esterno eseguibile viene considerato affidabile senza review.

# Workflow

1. Cerca skill coerenti con il bisogno.
2. Recupera i file della candidata.
3. Trova e valida il relativo SKILL.md.
4. Confronta con il catalogo interno.
5. Classifica la candidata.
6. Se approvata, importa su branch dedicato.
7. Esegui validate-randskills, test e security gate.

# Validation

Ogni skill importata deve avere frontmatter valido, scope esplicito, azioni consentite/vietate e workflow verificabile. Un repository completo non è una skill: l'importer deve cercare ricorsivamente i SKILL.md e importare solo i pacchetti skill pertinenti.
