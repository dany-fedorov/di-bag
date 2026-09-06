# Real box package fixtures

These test-only archives are generated unchanged with `npm pack --ignore-scripts
--pack-destination /absolute/path/to/di-bag/tests/fixtures/box-packages` from the
verified independent checkouts. They allow fresh offline consumer tests without
depending on `.related-repos` or temporary artifacts. They are excluded from the
published di-bag package by its `files: ["dist"]` allowlist.

| Archive | Repository revision | SHA-512 |
| --- | --- | --- |
| sas-box-0.1.0.tgz | b895f9d1f1d168992f44e9f46025bc1ac9d26e14 | 1df071c09f98ae59141986622f174a1180d28835acd4aef2d7aac5339e5e5debfeb4d9c5de9f32d87181f92183c3a18af1ac4b84a4baec43971b3aec62d329db |
| val-box-0.1.0.tgz | 07506fcb3e49f460b6de357ecad7d88262a7f32d | 3e4a4b9fbdb39523eab607f2f758e65fa86e919251655ca31e4905c2c4e3c12c3f214a54f64a4929ce01abac7d2ee92df105e51e614c4831d356c8c669cc7ed8 |

Provenance and prior package verification: `docs/reports/2026-09-06-box-foundations.md`.
Neither library source nor extracted implementations are copied into di-bag.
