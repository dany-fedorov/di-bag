# Sas Box and Val Box: skeptical evidence audit for LLM harnesses

Audit date: 2026-09-12. This report separates implementation facts, conditional architectural benefits, and claims that require comparative evidence. It examines local primary sources at Sas Box `5d553c52914b6becbdc661d77a67d94ea66b7ada`, Val Box `5f27fc2eb284f043c891cb64bbea6287dfd647fd`, and, for overlap only, DI Bag `7e47b6af7f5f9a662078a4c039d14f797ae1a51d`. The links below pin those revisions. Runtime code was unchanged; subsequent documentation follow-through added package rationale pages and qualified the README claims. The retained research probes are ordinary TypeScript assertions, not experiments measuring an LLM's performance.

## Chapter 1 — Sas Box: an acquisition-mode contract, with narrow incremental value

### What the library actually contributes

Sas Box is an optional provider utility. Its distinctive contribution is a reusable agreement about whether a dependency has a synchronous acquisition route, an asynchronous route, or both. That agreement can help an LLM harness with different execution phases, but nothing in its implementation is specific to models, tools, or workflow graphs. A provider passed to a graph node remains ordinary application dependency injection. The package supplies neither a node scheduler nor an execution graph. Its complete implementation is 188 lines of types, constructors, assertions, callback invocation, and namespace conveniences. [Implementation][S-code]

The strongest causal chain is: a synchronous host phase cannot await an asynchronously initialized dependency → require `SasBox.Sync<T>` with a concrete, non-Promise `T` → the compiler rejects an async-only replacement, and an unknown provider can be checked with `assertHasSync()` → incompatible integrations fail at that boundary. The host must still define the phase, decide which providers belong in it, validate external inputs, and actually execute its assertions. This is useful when one provider family serves a synchronous local configuration or policy phase and an asynchronous runtime. It does not itself make either phase deterministic. [Types and assertions][S-code]

A second chain is weaker but real: independently implemented providers may throw before returning a Promise → the common async entry point catches a synchronous throw and returns a rejection → an async consumer can handle errors uniformly with `await`/`catch`. `invokeAsPromise` invokes immediately inside `try`, then calls `Promise.resolve`; this assimilates structural thenables and flattens eventual values. Direct `.sync()` preserves both the exact return value and synchronous throws. The runtime suite demonstrates these distinctions, rather than an improvement in agent output quality. [Normalization][S-normalize], [runtime tests][S-tests]

### Exact modes, strict access, and the limits of synchronous evaluation

`fromValue(value)` returns a sync box whose callback returns that same supplied value. `fromSync(fn)` supplies `fn` directly as `.sync` plus a Promise adapter. `fromAsync(fn)` returns an async-only class with `.sync === undefined`; awaiting it does not add a synchronous route. `Unknown` means the static type allows a missing sync callback, not that the library investigates a provider and discovers its eventual behavior. `hasSync()` checks `typeof this.sync === 'function'` without executing acquisition. Its boolean return does not narrow an unknown box; the caller uses the value returned by `assertHasSync()`. A direct call to an absent `.sync` is an ordinary missing-function error if TypeScript is bypassed. The explicit assertion supplies the alias-bearing library error. [Constructors and capability methods][S-code], [type fixtures][S-positive]

Crucially, `Sync<T>` means synchronous acquisition of `T`, not completion of all work represented by `T`. `SasBox.fromSync(() => Promise.resolve(true))` validly exposes a synchronous route returning a Promise. It cannot satisfy `SasBox.Sync<boolean>` under the tested strict compiler settings. Therefore a claim about synchronous invariant evaluation needs the invariant's concrete boolean or configuration type; a generic sync capability alone is insufficient. The library does not reject blocking I/O or side effects in a callback. [Promise-valued runtime test][S-tests]

Synchronous invariant evaluation has a substantive benefit only when immediate completion is a requirement: for example, a pure graph-configuration validator called by a synchronous API, or a local guard required to return a boolean before the caller proceeds. A caller using `await` introduces a continuation boundary even for an already available value. Sas Box's `.async()` nevertheless runs its underlying sync callback immediately, so it does not offload blocking work. `resolveSyncFirst()` also always returns a Promise; it is route selection, not a synchronous evaluation API. If every host phase is already asynchronous, an `async` factory is often sufficient and the extra synchronous interface adds little. No latency improvement was measured. [Resolver][S-resolver], [README's blocking-work clarification][S-readme-modes]

Two supplied routes need only have compatible TypeScript payload types. They can return different numbers or read different revisions. A probe constructed `new SasBox.Sync(() => 1, async () => 2)`: direct sync returned 1, direct async returned 2, and sync-first returned 1. Sync-first never falls back to async because the sync route throws; it selects based on presence, then returns the failure as a rejection. Equivalence, freshness, and fallback are host policies. An evaluation that swaps a fixture for a production provider must test those semantic obligations separately. [Resolver implementation][S-resolver]

### Lifecycle, concurrency, arguments, and graph boundaries

There is no value cache or failure cache. Repeated access invokes the provider again; there is no pending-operation registry providing single-flight behavior. A test explicitly asserts non-memoization, and the audit probe confirmed that two concurrent async calls start two acquisitions. Three failing accesses executed the failing callback three times. That is fresh invocation after each call, not a retry policy: the box never retries autonomously. A provider returning an already shared Promise or object can create sharing, but that behavior belongs to the closure. `fromValue` returns a stable reference because its closure captures one value, not because Sas Box memoizes arbitrary loaders. [Factories][S-code], [non-memoization test][S-tests]

There is also no evaluation scope, reset, disposal, cancellation, timeout, or dependency-cycle detector. A bounded recursive probe invoked the same sync provider five times before a host sentinel threw; no library cycle error intervened. Unbounded synchronous recursion is ordinary recursion, while asynchronous dependency deadlocks require host machinery to diagnose. A provider allocating a client on each invocation needs explicit ownership and cleanup. A provider closing over a mutable current-run object risks reading the wrong run if reused concurrently. These concerns are not solved by attaching an alias. [Complete implementation][S-code], [documented lifecycle exclusions][S-readme-scope]

Provider callbacks accept zero arguments. `resolveSyncFirst(thisArg)` passes a receiver, not a query or execution context parameter. The supplied receiver is forwarded to the selected callback; method binding and factory adapters deserve care, so closures or explicitly bound methods are simpler. A harness typically acquires a client and calls `client.search(query, signal)` afterward, or constructs a provider closure per run. Sas Box cannot enforce the search method's argument schema, permission checks, retry budget, or idempotency. The README retrieval example correctly separates acquisition from invoking a client's method. [Receiver tests][S-tests], [harness example][S-readme-harness]

There is no `map` or metadata API. The README's owner/purpose catalog is a host-created object beside a box, not a retained library metadata layer. Consequently there are no built-in rules for when projections or metadata callbacks run, how derived providers share work, or which acquisition a metadata record describes. A closure such as `fromSync(() => project(source.sync()))` projects on every call; caching it changes that only because the host added caching. Copying a catalog entry does not establish provenance for a particular acquired value. [Complete API][S-code], [application catalog example][S-readme-catalog]

### The plain TypeScript baseline and DI Bag overlap

A credible baseline preserves the same useful boundary:

```ts
type Provider<T> = {
  sync?: () => T;
  async: () => Promise<Awaited<T>>;
};
const fromSync = <T>(fn: () => T) => ({
  sync: fn,
  async: async () => fn(),
});
function requireSync<T>(provider: Provider<T>): () => T {
  if (!provider.sync) throw new Error('sync route missing');
  return provider.sync;
}
```

This small baseline catches synchronous throws through its async function and assimilates returned thenables. Merely writing `() => Promise.resolve(fn())` does not normalize synchronous throws: `fn()` is evaluated before `Promise.resolve` receives its argument. An async function or explicit try/catch fixes that baseline defect; no library is necessary. The shown baseline intentionally omits receiver-binding conventions, alias-rich diagnostics, and convenience classes. A strict structural type requiring `sync` rejects an async-only producer just as Sas Box does. For an always-async consumer, `(deps) => async (...) => ...` or an injected `() => Promise<T>` already provides a replaceable, locally testable module boundary. Sas Box's incremental value is a maintained vocabulary and adapters shared across producers and hosts, not unique access to dependency inversion or TypeScript checking. Its exported structural interfaces make that narrow role especially explicit. [Structural interfaces][S-code]

DI Bag already has typed registrations and direct/awaited service transformations, plus acquisition tracking, caches, scopes, and resource ownership. Its `transformService` retains metadata and existing cleanup across a transformation; those are DI Bag mechanisms and must not be attributed to Sas Box. Inside a DI Bag-only application whose registrations already state the needed types and acquisition behavior, another wrapper can duplicate concepts. Sas Box earns its place where providers also cross boundaries outside the container, or a separate host must inspect the presence of a sync route before acquisition. Registering `() => box.async()` remains an adapter; resolve and ownership behavior come from the container. [DI Bag transforms][D-transform], [DI Bag acquisition][D-acquisition], [composition guidance][S-readme-scope]

### Claim-strength ledger, adoption cases, and comparative evaluation

| Strength | Claim and evidence boundary |
| --- | --- |
| Demonstrated mechanism | Typed sync/async capability, zero-invocation inspection, explicit sync assertion, Promise/error normalization; source, 13 runtime tests, and audit probes support them. |
| Conditional benefit | A host with an immediate-return requirement can reject async-only plugins; requires a concrete non-Promise output type and host enforcement. |
| Conditional benefit | A common provider vocabulary can simplify integration across packages; depends on enough producers and consumers to justify standardization. |
| Unmeasured hypothesis | Smaller coding-agent context, faster iteration, fewer integration errors, or better task completion than plain TS. No comparative agent experiment supports these claims. |
| Unsupported | Built-in single-flight, memoization, failure retention, transformation metadata, cycle detection, or harness execution policy. These mechanisms are absent. |

A high-value candidate is a plugin ecosystem where the same provider family serves a synchronous command/configuration host and an async service host, with several independent implementers. A small all-async retrieval pipeline is a poor candidate: one injected factory already makes its node independently testable. A long-lived remote-client pool is also a poor fit if the desired feature is lifecycle management; wrapping it supplies none of the missing policy. These adoption judgments are architectural inferences, not observed project outcomes.

The current README's “Modularity for context engineering” should remain a conditional usage argument: the interface permits a consumer-focused task context, but does not select that context or show that an agent succeeds with less information. “TypeScript for quick evals” combines compiler contract checks with fixture assertions; neither is an evaluation of an LLM nor proof that remote providers behave correctly. “Programmable provider capabilities” accurately covers alias and sync-route inspection; application-defined catalog metadata should remain visibly separate. The existing cache, blocking-work, argument, and host-ownership qualifications are accurate and should be preserved. [Current wording][S-readme]

To test incremental value, implement one fixed node family with Sas Box, an equivalent structural provider, and a plain async-factory variant where immediate return is unnecessary. Keep runtime behavior, fixtures, task instructions, and documentation budget comparable. Inject async-only replacements into sync consumers, synchronous throws, thenables, divergent dual routes, concurrent acquisition, and mutable captured run state. First compare correctness and lines of host glue. Then run repeated coding-agent change tasks with randomized condition assignment, measuring completed tasks, introduced defects, context tokens, and review corrections. Record execution latency only in a dedicated controlled benchmark. Sas Box's adoption case weakens if it adds integration code without reducing errors or if the async-only baseline satisfies every real requirement. Those are falsifiable outcomes; the present probe only establishes mechanism parity on selected cases.

## Chapter 2 — Val Box: independent presence channels and shallow snapshots

### What the library actually contributes

Val Box is an optional in-process value-presence utility. It combines a value channel and an independently optional metadata channel, mutable builders, presence-constrained variants, conversions, and shallow-frozen snapshots. Its most defensible harness use is preserving a distinction a particular application needs: “no result supplied” versus “a supplied value whose payload may be undefined, false, zero, or empty.” It does not supply result success semantics, provenance verification, graph routing, checkpointing, or a general transformation algebra. [Mutable implementation][V-state], [snapshot implementation][V-snapshot]

The causal chain for a configuration boundary is concrete: a fallback must apply only when a field is absent → presence is stored independently of payload → a snapshot exposes `{ present: false }` or `{ present: true, value }` → the consumer branches on `present` and preserves an explicit override. The host must decide whether explicit `undefined` means clearing a default, disabling a feature, or something invalid. The README's setting fixture demonstrates absent, zero, and supplied undefined; that distinction would be lost by testing truthiness, and supplied undefined would be lost by treating `getValue() === undefined` as absence. [Configuration example][V-readme-config]

This is meaningful for a harness configuring retry limits or assembling optional context, but it is not inherently an LLM concern. `0` must survive when it means no retries; `false` must survive when it disables a capability. A retrieved empty array can mean a completed search with no matches, but presence alone does not establish completion. A host could put `[]` into a box before searching. The meaning comes from the producer's contract and runtime protocol. If undefined always means missing, `T | undefined` is sufficient; if both value and metadata are always required, a plain record is clearer. [README's stated alternatives][V-readme-scope]

### Two independent channels, with specific type guarantees

The mutable base stores `_hasValue` and `_hasMetadata` separately from `_value` and `_metadata`. Setters mark presence true for any admitted payload; deletion resets the payload to undefined and presence false. The audit compared both channels for undefined, null, false, zero, empty string, and NaN against plain presence unions: all matched. `getValue()` and `getMetadata()` alone remain ambiguous between absence and supplied undefined. Runtime assertions consult their own channel; they return `this`, not a statically refined replacement. Use a snapshot discriminator or `convert` for static refinement. [State methods][V-state], [independent assertions and conversions][V-tests]

There are nine static value/metadata combinations: each axis can be unknown, required, or absent. Required channels cannot be deleted through their ordinary API but can be replaced; absent channels cannot be set. “Unknown” is a type-level allowance for either runtime presence state, not a third runtime state. The methods implement these restrictions by throwing `MethodNotAllowedError`; some impossible setters also take `never`. Runtime-backed constraints help an incremental builder publish a required-value contract, but create a larger API than a two-branch union. Protected and readonly TypeScript declarations are not a hostile-code isolation boundary. [Required channel implementation][V-required], [negative type fixtures][V-negative]

`convert({ hasValue, hasMetadata })` always creates another mutable box. A true flag requires and retains that channel, throwing if absent; false removes the channel in the new box; omitted/undefined preserves runtime presence while allowing either state statically. False is a projection, not an assertion that the original lacked that channel. Literal flags select precise result classes; widened booleans produce unions. Conversions preserve intentional aliases and payload references. Nine combination tests and present-undefined tests support these semantics. They do not prove a converted payload satisfies an external data schema. [Conversion implementation][V-convert], [conversion tests][V-tests], [positive type fixtures][V-positive]

### Snapshot stability is smaller than immutable data or replay

The box itself is mutable. A snapshot freezes three objects: its outer record, its value presence record, and its metadata presence record. It copies the intentional alias and captures payload references. Later `setValue` or `delMetadata` calls on the box do not replace those snapshot references or flags. Nested payload objects remain shared and mutable. A converted box is also mutable, and its payload references are shared with the original. Calling either output an immutable result without this qualification overstates the guarantee. [Snapshot code][V-snapshot], [snapshot tests][V-snapshot-tests]

For a graph handoff, this prevents one specific bug: reusing a mutable builder cannot retroactively remove the handed-off snapshot's value channel. It does not prevent another node from changing an object in that channel. The probe captured `{ count: 1 }`, replaced the builder's value, then mutated the original object's count to 99; both the snapshot and a preserving conversion observed 99. A metadata `fresh` property was similarly mutable through the retained reference. The host needs immutable payload conventions, cloning/selection, or explicit serialization if it requires isolated branch state, stable audit records, or repeatable checkpoints. [Sharing tests][V-tests], [snapshot implementation][V-snapshot]

### Metadata is carried data; transformations and decisions remain outside

A useful second chain is: absence itself needs explanation → metadata presence is independent of value presence → a producer can return no payload with a missing-source or policy reason → a host can route or diagnose without manufacturing a business value. For supplied data, provenance fields can travel with the payload to a separate inspector. The library contributes carriage and presence tracking; the producer defines the metadata schema and computes its fields, while the consumer implements policy. The README's freshness flag and `nextNode` function are application code. [Metadata example][V-readme-metadata], [retrieval routing example][V-readme-harness]

Neither Val Box nor Sas Box has a `map` method. Val Box's `convert` does not transform a payload or invoke a metadata callback. It preserves or drops existing channels. Mapping a result into a summary therefore requires a host function that constructs a new box or snapshot. Whether original metadata remains valid after summarization, redaction, filtering, or merging sources must be decided explicitly. Keeping a document revision next to a summary may be useful, but does not establish that the summary faithfully represents that revision. Dropping the metadata channel with conversion also cannot remove a secret already embedded in the value. [Complete API and conversion][V-code]

Presence is orthogonal to result success and execution state. A present `Error` is still present; metadata-only output could mean a cache miss, denied access, not-yet-executed work, or a failed search. A harness needing exhaustive control flow should define something such as `pending | success | failure | cancelled`, with typed reasons and outputs appropriate to each state. Wrapping that discriminated union in Val Box may be redundant unless independent absence is also required. The box catches no tool exceptions, implements no retry branches, and enforces no allowed state transitions. “Graph-node result contract” is a supported use; “graph execution model” is unsupported. [State API][V-state], [README's status qualification][V-readme-harness]

### Transport and provenance trust constraints

Snapshots are ordinary JavaScript records, not a complete wire protocol. In the audit, JSON serialization of supplied undefined produced `{"value":{"present":true},"metadata":{"present":true},"alias":null}`. The `present` flags survive, so JSON does not collapse the record to `{ present: false }`; it does remove the payload property. A codec must specify whether to reconstruct undefined or reject that shape. NaN becomes null; additional arbitrary payloads can be nonserializable or change representation. A durable workflow must validate and encode permitted payloads and metadata, version its schema, decode on resume, and define state-update rules. `snapshot()` does none of that. [Snapshot shape][V-snapshot], [documented transport limitation][V-readme-scope]

Metadata named `source`, `revision`, `confidence`, or `fresh` is still supplied data. An untrusted producer can claim `fresh: true` or impersonate a source name, and a mutable reference can change after handoff. Runtime schema validation can check a field's shape but cannot establish its truth or authority. A harness using these fields for permission or retrieval trust must assign authenticated identities and trusted policy facts in its own boundary. It must also select metadata appropriate for logs and model context. This follows from unrestricted generic metadata storage; it is not a discovered exploit or a claim that all metadata needs cryptographic signing. [Metadata setter][V-state], [README trust qualification][V-readme-scope]

`ValBox.isValBox` checks `instanceof` against this loaded package copy plus an instance symbol. It is not a validator for a JSON snapshot, a payload schema, or another installed copy's classes. The probe confirmed decoded JSON returns false. Structural snapshots make cross-module consumption straightforward, but class identity must not be used as remote provenance or authentication. [Identity check][V-identity]

### The plain TypeScript baseline and where the library earns its cost

The central representation is itself a small discriminated union:

```ts
type Presence<T> =
  | { readonly present: false }
  | { readonly present: true; readonly value: T };
type Reading<V, M> = {
  readonly alias: string | null;
  readonly value: Presence<V>;
  readonly metadata: Presence<M>;
};
const present = <T>(value: T): Presence<T> =>
  Object.freeze({ present: true, value });
```

Constructing two frozen presence records and a frozen outer record reproduces snapshot behavior. Both representations force a presence check before reading a union payload under strict TypeScript. `Map.has` versus `Map.get` or `Object.hasOwn` also distinguishes a missing property from supplied undefined before constructing a result. The audit's plain union fixtures matched Val Box's snapshots across all tested presence values. Thus snapshot-based consumer modularity, provenance fields, and typed routing can exist without the library. Val Box adds a ready-made mutable builder API, the nine presence-constrained variants, checked conversion, consistent aliases, assertions, and snapshot construction. [Snapshot representation][V-snapshot], [mutable and conversion APIs][V-code]

A high-value candidate is an adapter layer that incrementally gathers payload and diagnostic context from several sources, repeatedly needs independent presence, and publishes stable channel records to several consumers. Reusing one tested builder/conversion vocabulary may help there. A poor candidate is a JSON-first graph with an existing `SearchOutcome` union and immutable state updates; wrapping every outcome can create redundant absence states and extra encoding work. An all-required `{ value, metadata }` exchange is another poor candidate. DI Bag can acquire either a box or a snapshot, but its registration/acquisition metadata describes container operations, whereas Val Box metadata describes an application result. Translating between those meanings is host work. [DI Bag metadata implementation][D-transform], [Val Box composition guidance][V-readme-scope]

### Claim-strength ledger and falsifiable next evaluation

| Strength | Claim and evidence boundary |
| --- | --- |
| Demonstrated mechanism | Independent presence, required/absent variants, checked conversion, shallow-frozen snapshots; source, 19 runtime/snapshot tests, and probes support these. |
| Conditional benefit | Distinguishes omitted input from explicit override and preserves absence reasons, if that distinction belongs in the domain and producers honor it. |
| Conditional benefit | Reduces repeated builder and conversion code across adapters, if those operations recur sufficiently to justify the API. |
| Unmeasured hypothesis | Fewer coding-agent mistakes, smaller effective context, faster harness development, better routing outcomes than an equivalent union. |
| Unsupported | Deep immutability, automatic payload mapping or metadata propagation through transformations, verified provenance, schema validation, JSON round-trip guarantees, or graph control flow. |

Current wording to qualify is specific. “Where it came from” means a field supplied by an application, not an origin established by Val Box. “Metadata for programmable tooling” accurately describes a substrate for policies, but freshness computation and actions remain external. “Modularity for context engineering” and “TypeScript for quick evals” should be conditional architectural uses, with explicit credit to module boundaries, TypeScript, and host assertions. The README already carefully states the mutable/snapshot distinction, shallow sharing, independent status semantics, and encoding constraints; those qualifications are supported by the audit. [Current wording][V-readme]

A fair comparison implements the same settings/retrieval contract with Val Box builders and with plain frozen presence unions. Keep result states and type strictness equal. Include absent versus supplied undefined, all falsy payloads, metadata-only absence, forbidden conversions, nested mutation after publication, JSON round trips, stale provenance after transformation, and concurrent branch handoffs. Measure adapter code, defects caught, debugging/review time, and consumers' required context. For agent claims, repeat standardized changes with randomized library/baseline assignment and comparable documentation exposure; distinguish compiler diagnostics from actual task success. The case for Val Box weakens if the union is as safe and materially simpler, or if builders are never reused. No current evidence warrants a generic claim that wrapping graph outputs improves an agent's reasoning.

## Executed verification and reproducibility

Commands ran with `login: false` and installed local tools. The source-only suites were selected because the package/type-fixture suites invoke builds and would write to the audited repositories. No full build or packaging verification is claimed.

Reproduction assumes sibling checkouts named `di-bag`, `sas-box`, and `val-box` under any common parent directory, with Sas Box and Val Box at the revisions above. The retained probes import sibling `src/index` files through relative paths, so no published package installation or library build is needed. Bun (observed 1.4.2), Node.js, and npm must be on `PATH`. Install the audited packages' development dependencies with `npm ci` in each sibling checkout; this supplies TypeScript 5.9.3 and Bun declarations for the package typechecks. Dependency setup writes `node_modules`; the verification commands below do not emit builds. Run the commands from the `di-bag` root unless the table specifies a sibling working directory. Check each sibling's `git rev-parse HEAD` against the revisions above before interpreting results.

| Working directory | Command | Observed result |
| --- | --- | --- |
| `../sas-box` | `bun test tests/runtime.test.ts` | 13 pass, 0 fail, 30 expectations; Bun 1.4.2. |
| `../val-box` | `bun test tests/runtime.test.ts tests/snapshot.test.ts` | 19 pass, 0 fail, 89 expectations. |
| Each audited sibling package | `npm run typecheck` | Exit 0; configured `tsc` uses `noEmit: true`. |
| `di-bag` root | `bun docs/research/box-harness-probe.ts` | All comparison assertions passed; output below. |
| `di-bag` root | `../sas-box/node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module commonjs docs/research/box-harness-types.ts` | Exit 0; eight `@ts-expect-error` checks remained required, positive assignments compiled. |

The [runtime probe](box-harness-probe.ts) and [compile-only type probe](box-harness-types.ts) are retained beside this report. The runtime probe imports sibling source directly, compares ordinary closures/union records, counts invocations, bounds recursion with a host sentinel, and tests shared references and serialization. The type probe checks source APIs and equivalent plain types; its declared fixtures are compile-only, so do not execute it with Bun. These checks do not re-run the separate declaration-emission fixtures cited as repository evidence. Both portable probe commands above were rerun after moving the files into this directory and produced the reported results.

```text
sas: repeated calls=2; failure executions=3; concurrent acquisitions=2; sync after await=undefined
plain: repeated calls=2; failure executions=3; concurrent acquisitions=2; sync after await=undefined
sas: inspection executions=0; ordering=provider,caller,then; dual routes may differ; recursive calls reached host sentinel=5; no map/metadata
val: 6 falsy/undefined cases equal plain unions on both axes; box/convert mutable; snapshot shallow-frozen; nested mutation visible; no map
val: present undefined JSON={"value":{"present":true},"metadata":{"present":true},"alias":null}; NaN becomes null; decoded JSON is not a ValBox
```

[S-code]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/src/index.ts
[S-normalize]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/src/index.ts#L19-L28
[S-resolver]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/src/index.ts#L68-L90
[S-tests]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/tests/runtime.test.ts
[S-positive]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/tests/types/positive.ts
[S-readme]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/README.md
[S-readme-modes]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/README.md#L248-L275
[S-readme-scope]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/README.md#L332-L359
[S-readme-harness]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/README.md#L181-L246
[S-readme-catalog]: https://github.com/dany-fedorov/sas-box/blob/5d553c52914b6becbdc661d77a67d94ea66b7ada/README.md#L132-L179
[V-code]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/index.ts
[V-state]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/index.ts#L268-L310
[V-snapshot]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/snapshot.ts
[V-convert]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/index.ts#L129-L266
[V-required]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/index.ts#L363-L558
[V-identity]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/src/index.ts#L811-L823
[V-tests]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/tests/runtime.test.ts
[V-snapshot-tests]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/tests/snapshot.test.ts
[V-positive]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/tests/types/positive.ts
[V-negative]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/tests/types/negative.ts
[V-readme]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/README.md
[V-readme-config]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/README.md#L62-L110
[V-readme-metadata]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/README.md#L165-L214
[V-readme-harness]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/README.md#L216-L274
[V-readme-scope]: https://github.com/dany-fedorov/val-box/blob/5f27fc2eb284f043c891cb64bbea6287dfd647fd/README.md#L382-L415
[D-transform]: https://github.com/dany-fedorov/di-bag/blob/7e47b6af7f5f9a662078a4c039d14f797ae1a51d/src/provider.ts#L121-L188
[D-acquisition]: https://github.com/dany-fedorov/di-bag/blob/7e47b6af7f5f9a662078a4c039d14f797ae1a51d/src/acquisition.ts
