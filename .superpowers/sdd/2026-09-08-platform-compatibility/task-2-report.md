# Task 2 report — portable root contract and Deno consumer

Source checkpoint: `f41271b08f0bf588590b47e21b98927e85020006`.

## RED/GREEN evidence

The Node control was written before the portable fixture. Its first run failed
because `tests/platform/portable/contract.ts` did not exist:

```text
$ bun test tests/platform-deno.test.ts
Cannot find module './platform/portable/contract'
0 pass, 1 fail, 1 error
```

The first fixture run then rejected implicit Promise classification through the
portable root facade. Every fixture provider now declares `acquisition: 'raw'`,
which removes host Promise classification from the shared Deno/browser
contract. The next RED mutation supplied a real resolved module beside a
missing expected package directory; the validator threw `ENOENT`. It now treats
both missing or foreign real paths as a closed validation failure.

The final focused suite verifies the exact portable result, canonical child
output, empty stderr, local real-path containment, exact result matching,
missing-install handling and the manifest-driven unavailable row. A review fix
also routes inspection through a pure validator that requires non-null snapshot
and metadata objects, exact `{ portable: true }` metadata, and both objects to
be frozen. Mutation cases cover primitives, missing/wrong/extra metadata and
either unfrozen object. Exactness uses all own keys, with explicit symbol and
non-enumerable extra-key mutations. This also corrected the fixture to inspect
the canonical root binding rather than the alias-local metadata snapshot.

```text
$ bun test tests/platform-deno.test.ts tests/platform-evidence.test.ts
15 pass
0 fail
121 expect() calls
```

## Deno availability

`tools/platform-versions.json` records Deno as
`unavailable: not-provisioned`. `runDenoLane` returns an explicit `deno-root`
unavailable row before reading or installing an archive. No Deno process ran,
so local bare-package resolution is not claimed. No runtime was downloaded and
no `npm:di-bag`, registry URL, source import or worktree `dist` fallback was
used.

The committed consumer imports bare `di-bag`, resolves it with
`import.meta.resolve('di-bag')`, and emits one canonical JSON object. The parent
lane is ready to install the freshly built archive offline into a unique
consumer, recursively copy the portable fixture, invoke the verified Deno
binary with `run --node-modules-dir=manual --allow-read`, and require the real
resolved module to remain beneath that consumer's installed archive.

## Redundant gates

```text
$ bun test tests/package.test.ts tests/native-package.test.ts
79 pass
0 fail
1,647 expect() calls
Ran 79 tests across 2 files. [206.79s]

$ npm run typecheck
exit 0
$ npm run typecheck:native
exit 0
$ npm run build
exit 0
$ npm run build:native
exit 0

$ npm test
794 pass
0 fail
4,734 expect() calls
Ran 794 tests across 42 files. [543.51s]
```

The package matrix exercised fresh installed artifacts across Node/Bun and the
classic/native declaration paths. Deno execution remains unavailable rather
than inferred from those controls.
