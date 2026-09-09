# Optional comparator status at `ad70a14`

These rows were emitted on 2026-09-08 by:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/performance-evidence.ts --comparators
```

The source revision is
`ad70a143cfa8b83dab8050e1592c273791cb7085`. The inspected
`package-lock.json` SHA-256 is
`a68e095582633c5b4d58b6fd01a26d982b9e932c4072db94473210dfc89fc4eb`.
The comparator-contract source SHA-256 is
`5bedba7c16928e4fd1f50e70eef9240b4ae73455451b001a46034449430f70c4`.

Both optional packages are absent from the lockfile:

| Package | Status | Reason |
| --- | --- | --- |
| Typed Inject | unavailable | not-lockfile-pinned |
| Awilix | unavailable | not-lockfile-pinned |

No package was downloaded and no adapter or timing row was fabricated. A
future row can enter a table labelled **restricted common-subset throughput**
only after its exact package version and integrity are present in the lockfile,
the same named version is installed, and a source-hashed adapter passes the
semantic contract. The contract executes a three-service named graph and
verifies synchronous resolution, singleton identity, transient freshness and
explicit disposal. Rejected Promises returned from forbidden asynchronous
construction or resolution are consumed before non-admission is returned. An
installed package without a reviewed adapter is `not-comparable`; a semantic
failure remains `not-comparable`.
