# RandAI Block 5 — Points 17–20

Canonical modules:

- 17 Evaluation / Benchmark: `src/randai/evals/`
- 18 Multi-Agent: `src/randai/agents/`
- 19 Permission / Autonomy: `src/randai/autonomy/`
- 20 Recovery / Self-Correction: `src/randai/recovery/`

## Invariants

1. Evaluation results are scoped when operational context exists; cross-hotel/project/task baselines are not comparable.
2. A benchmark regression must be explicit; a passing candidate cannot be inferred from average score alone when the baseline passed and the candidate fails.
3. Multi-agent graphs are DAGs, bounded by agent/concurrency limits, and tasks can only require tools declared by the selected agent.
4. Agent telemetry is diagnostic only: instrumentation failure cannot turn successful operational work into a failed run.
5. Approval identity includes operational scope and stable input serialization. Same action in two hotels is two different approvals.
6. Critical/admin actions continue to require human control according to the autonomy policy; policy contradictions are rejected fail-fast.
7. DurableTaskRunner propagates hotel scope to normal authorization and rollback authorization.
8. Recovery is bounded by total budget, same-strategy attempts and repeated-failure fingerprint. Safety and permission failures escalate instead of retrying automatically.
9. Recovery decisions remain part of the durable task audit trail and inherit task hotel scope.
10. No second runtime, policy engine, evaluator or recovery engine is introduced while the canonical module remains active and suitable.

## Zombie policy

`evals`, `agents`, `autonomy` and `recovery` are active, distinct layers and are not zombies. Duplicate registries, parallel approval engines, unreferenced recovery loops, obsolete tests or alternative implementations should be removed only after reference and contract analysis proves they are superseded.
