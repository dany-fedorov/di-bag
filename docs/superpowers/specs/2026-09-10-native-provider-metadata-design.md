# Native provider metadata

The user authorized removing the optional external provider adapters and their
integration/documentation, while preserving their useful concerns through DI
Bag's own mechanisms. Ordinary functions and explicit `mapSync`/`mapAsync`
projection already express acquisition capabilities; `Presence<T>` and ordinary
records express absent versus present-undefined values. Static annotations stay
in `withMetadata`.

The missing native capability is metadata computed for one acquisition and
visible through inspection/observers after projecting a plain result to its
payload. Add `DiBag.withAcquisitionMetadata(registration, describe)` and
`DiBag.withAcquisitionMetadataAsync(registration, describe)` using the existing
frame operations. Both annotators are synchronous and produce plain object records
with the local `Object.prototype` or a null prototype.
The immediate form describes the exact source output, preserving its identity
and acquisition policy. The async form awaits the source and exposes a native
Promise of that value. Each appends `Readonly<M>` to the typed acquisition
metadata tuple; shallow-copy/freeze record keys, retain payload identity, reserve
absent frames before source execution, propagate annotation errors through the
selected mode, and retain existing dependency/lifetime/ownership policies.
No automatic ownership, deep freeze, value unwrapping, aliases, or class matrix.
Reject invalid metadata records and accidentally asynchronous annotators.

The package has only root and node entry points and no external box dependencies
or archived test packages. Release tooling verifies one standalone DI Bag
archive. Retain meaningful provider/native Promise, lifetime, observer, token,
and declaration coverage by expressing fixtures through native APIs. Remove
obsolete integration-only tests and external-adapter documentation. Preserve
pre-existing untracked user work and independent package repositories. Public
guides and generated references describe native capabilities only. Historical
records must not be presented as current release instructions.

Verify native runtime/type contracts, packaging and release verifier behavior,
full check, native compiler check, generated docs, site build, and clean diff.
