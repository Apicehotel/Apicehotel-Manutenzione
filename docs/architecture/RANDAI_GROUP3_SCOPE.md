# Group 3 scope

This group establishes the canonical durable execution contract and safety invariants. It intentionally does not claim browser memory is production persistence and does not activate a paid/external queue. A production persistent adapter is enabled only with an actual durable workload and infrastructure decision. This is analogous to Group 2 optional projections: the architecture is complete while infrastructure activation remains governed and demand-driven.
