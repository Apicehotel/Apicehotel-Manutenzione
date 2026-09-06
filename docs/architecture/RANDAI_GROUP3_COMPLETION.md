# Group 3 completion criteria

Group 3 is merge-ready only when GitHub CI proves:

1. Group 1 tool authorization remains green.
2. Group 2 knowledge boundary remains green.
3. Existing recovery contracts remain green.
4. Group 3 authorization, idempotency, checkpoint/resume, retry bound, version mismatch, cancellation, knowledge refresh, store contract and no-parallel-runtime tests are green.
5. Full repository CI remains green.

No production executor is activated by this merge. This closes the architecture/runtime contract while keeping external infrastructure opt-in and governed.
