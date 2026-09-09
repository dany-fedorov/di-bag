# Repeated compiler controls at `e5456f8`

These are informational measurements from 2026-09-08 on Linux
`7.0.11-76070011-generic` x86_64 with Node `v24.20.0`. The measured source is
commit `e5456f8e435cddb03b1dc61b3c777bb9916d35da`, tree
`0cfe3befdc433561d61e3d0b97c567421b43b3bc`, and production-source SHA-256
`90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`.
The package lock SHA-256 is
`a68e095582633c5b4d58b6fd01a26d982b9e932c4072db94473210dfc89fc4eb`.

`compiler-controls-2026-09-08T11-21-35.870Z.jsonl` contains one header, 648
fresh-child records, 18 derived summaries, and one completion record. The
children comprise 90 warm-ups and 558 retained samples. Every child records
the exact compiler identity, source and generated-fixture hashes, clean source
status, diagnostics, compile/process time, RSS, and instantiations. Independent
validation recomputed all summary statistics and checked every identity,
provenance value, work metric, TS2589 exclusion, and exact boundary marker.
The file SHA-256 is
`3f13f311f553b870f86651eb7817e983d7b9400858bec8e65c203bba76452979`.

The original journal preserves the absolute diagnostic file text emitted by
each measured compiler, including native compiler paths in removed temporary
directories. The clone-stable
`compiler-controls-diagnostic-identities.json` maps all 504 sample diagnostics
to their declared generated fixture after verifying every captured suffix; its
SHA-256 is
`1d35a665cf38000074e917d468cbb9cd91a95286fcecdf6419a96c15f826de8d`.
The runner now emits that stable relative file identity directly. This derived
manifest keeps the completed measurements intact and avoids rerunning them.

The repeated controls were run once with:

```sh
npm run benchmark:compiler-controls
```

The four `matrix-*.log` files retain the later full exhaustive commands. Their
summaries remain 30/36 classic named, 12/18 classic tokens, 28/36 native named,
and 13/18 native tokens: 83/108 accepted. Their SHA-256 values are:

- `matrix-classic-named.log`: `a933dec56ecba4c58a1fa5a5ede77f38a8fdc8570968207e8b6be92dd566a258`
- `matrix-classic-tokens.log`: `e3e25ae7fbbaaeacf5ad777ec76c7389c5011bea446fc53579e83c1a00487d31`
- `matrix-native-named.log`: `2947ea25e9abb16b3cd9e7327a5e3a16a88d1939c13c819cc995de813cfdd2ff`
- `matrix-native-tokens.log`: `b23ad38cd3cb0421b5ed74c494c15a116cf3fcd303be6ba6b394636c7921eccd`

The full matrix and repeated controls serve different purposes. The repeated
controls show stable behavior for three supported fixture families. They do not
establish support for the unresolved 500/1,000 individual-chain cases and do
not replace or soften any exhaustive failure.
