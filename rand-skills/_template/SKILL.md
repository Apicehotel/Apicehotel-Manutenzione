---
name: replace-me
description: Describe what this skill does and when RandMind should activate it.
---

# Scope

State the capability boundary and required hotel/user scope.

# Permissions

List the RandCore capabilities required. UI visibility is never authorization.

# Allowed actions

- Read only the minimum authorized context.
- Use existing Rand tools and canonical domain workflows.

# Forbidden actions

- Never bypass RLS/RPC, Safe Write, Action Gateway or audit.
- Never expose secrets, service-role credentials, PINs or cross-hotel data.
- Never self-approve critical changes.

# Workflow

1. Validate identity, hotel scope and intent.
2. Load only the required context.
3. Execute through canonical Rand tools.
4. Validate result and surface uncertainty.
5. Record auditable outcome where required.

# Validation

Define success, failure, rollback/fallback and tests before promotion.
