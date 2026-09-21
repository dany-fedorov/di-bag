# Phase 2 evidence: non-breaking names

Measured on branch `phase-02-non-breaking-names` after the last task.

| Case | Baseline | Now | Change |
| --- | --- | --- | --- |
| bulk 100 | 159,001 | 159,001 | 0.0% |
| chained 100 | 787,814 | 787,814 | 0.0% |
| grouped 100 | 166,348 | 166,348 | 0.0% |
| replacement 100 | 1,031,260 | 1,031,260 | 0.0% |
| bindings 100 | 847,247 | 847,247 | 0.0% |
| modules 100 | 1,241,644 | 1,241,644 | 0.0% |
| bulk 500 | 806,601 | 806,601 | 0.0% |
| chained 500 | 13,956,214 | 13,956,214 | 0.0% |
| grouped 500 | 1,060,372 | 1,060,372 | 0.0% |
| replacement 500 | 21,767,660 | 21,767,660 | 0.0% |
| bindings 500 | 12,153,047 | 12,153,047 | 0.0% |
| modules 500 | 19,719,044 | 19,719,044 | 0.0% |

No spike belongs to this phase.

## Names later phases meet

| Before phase 2 | After phase 2 |
| --- | --- |
| `factoryCtx`, `disposerCtx` | `factoryContext`, `disposerContext` |
| `deps` in signatures and JSDoc | `dependencies` |
| `deps` as the runtime proxy local | `dependencyProxy` |
| `Bag<R, C>` | `Bag<ServiceRegistrations, Constraints>` |
| `Builder<E, C>` | `Builder<Entries, Constraints>` |
| `Module<P, R, C, D>` | `Module<ExportedServices, RequiredServices, Constraints, PublicProviders>` |
| `Provider<F, M, A, G, V>` | `Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>` |
| `Token<K, S>` | `Token<TokenSymbol, Service>` |

A plan that adds or edits a method inside `class Bag` or `class Builder` writes
`ServiceRegistrations`, `Entries` and `Constraints` where older text says `R`, `E`
and `C`. Type parameters of methods and helper types kept their letters.

## Left for later phases

- The runtime message `'<key>' in deps` in `src/acquisition.ts` (phase 11).
- `factoryCtx` in `examples/react/project-runtime.ts` and in `docs/guides/react-integration.md`, which quotes it (phases 8 and 12).
- The four ids in `tools/docs/api-card-summary-exceptions.json` (phases 5, 8 and 9).
