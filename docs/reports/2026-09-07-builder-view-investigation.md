# Builder-view dependency erasure

A cast-free structural assignment can erase a root builder's consumer needs.
This predates incremental checking: the same program compiles with zero
diagnostics against both `33f8a8e0500218e34c5c1996c870ae1966932126` and
`d6c2710a6f953fdb66e1d829fb2ea08c683fb338`, then fails after replacement.

```ts
const empty = DiBag.begin();
const actual = empty.add({ value: () => 1,
  read: ({ value }: { value: number }) => value.toFixed() });
const erasedAdd = empty.add<{ value: () => number; read: () => string }>;
const erased: ReturnType<typeof erasedAdd> = actual;
const before: string = actual.end().resolve('read'); // "1"
const after: string = erased.replace('value', () => 'wrong').end().resolve('read');
// TypeError: value.toFixed is not a function
```

The instantiated method only names a builder type. No invalid registration call,
cast, `any`, unchecked input or suppressed diagnostic is needed. The replacement
checker sees the erased consumer signature, so even the previous full-map checker
cannot recover the real requirement.

Root Builder's existing emitted phantom member retains only module constraints
C, not registration history E. A virtual change to that same member retains both:

```ts
declare readonly [constraintInvariant]:
  (value: readonly [E, C]) => readonly [E, C];
```

The candidate rejects the counterexample at assignment with TS2322. A separate
control confirms rejection of a widened provider output with its narrower
consumer retained. Removing keys already rejects before the change and still
rejects. The unchanged builder retains its expected string output in the control.
Analogous finalized-bag and module-builder views already reject at assignment;
those classes need no change for this counterexample.

## Evidence and limits

TypeScript 5.9.3 / Node 24.20.0. Each case used a fresh child, 10-second timeout,
512 MiB old-space cap and immutable git-archive source. All children exited
normally with nonempty JSON. The counterexample's original runtime result was
"1" and its replacement threw the TypeError above on both pins. The candidate
rejects at line 5 in the seven-line generated reproduction.

Probe: `/tmp/di-bag-incremental-view-probe.cjs`. With `set -o pipefail`, pipe
`git archive d6c2710a6f953fdb66e1d829fb2ea08c683fb338 src` into
`timeout 10s node --max-old-space-size=512 /tmp/di-bag-incremental-view-probe.cjs d6c2710a6f953fdb66e1d829fb2ea08c683fb338 counterexample`.
Append `entry_invariant` for the virtual correction. Independent modes are
`controls`, `bag` and `module`. Runtime execution occurs only after zero compiler
diagnostics and uses transpiled immutable source.

This is focused source/runtime evidence, not adoption or full compatibility
proof. Production source and actual-installed declarations, equivalent-contract
builder assignments, existing inference and fixed compiler-work ceilings must
verify the correction. It makes builder annotations stricter: retain exact
inferred contracts instead of changing provider/consumer types through a view.
Full large matrices should measure the corrected final type boundary.
