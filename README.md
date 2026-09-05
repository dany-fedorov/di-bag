# DI Bag

A dependency bag for service factories: requirements inferred from each
factory's parameter type, totality checked at `.end()`, shapes checked at every
`.add`, cycles detected at resolve, `fork` for scoped or test graphs.

Current work: `src/v14/`. Design and evidence: `final-design-4+plan.md`.
Earlier iterations (`src/pattern-*`, `src/index*`) are history.
