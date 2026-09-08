# Optional comparator status at `bf8b1ac`

These rows were emitted on 2026-09-08 by:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/performance-evidence.ts --comparators
```

The source revision is
`bf8b1acbf35e55b3d7ceaeabcdd8a09e6d8651df`. The inspected
`package-lock.json` SHA-256 is
`a68e095582633c5b4d58b6fd01a26d982b9e932c4072db94473210dfc89fc4eb`.
The comparator-contract source SHA-256 is
`ed3520b3c2983ef8f6ae74eee84e01a52b793c59b84f5d7543e700f18813a327`.

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
explicit disposal. An installed package without a reviewed adapter is
`not-comparable`; a semantic failure remains `not-comparable`.
