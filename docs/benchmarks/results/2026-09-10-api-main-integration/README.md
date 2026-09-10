# API and main integration evidence (2026-09-10)

[Compiler controls](compiler-controls.json) retain 18 successful supported controls
on the combined API refactor and main performance changes, with unchanged source
hashes before and after every run. Each control uses one serial fresh process,
without warmups or repetitions. These observations are not a statistical
comparison or a replacement for the historical exhaustive matrix.

[Platform evidence](platform.json) retains successful archive, installed Deno, and
minified Chromium Worker results. Tool and artifact identities are preserved;
local paths and commands are omitted. Raw journal hashes bind these projections.

See the [integration verification report](../../../reports/2026-09-10-api-main-integration-verification.md)
for assumptions, source identity, review, gates, and publication status. Earlier
[API-only evidence](../2026-09-10-api-renaming/README.md) retains its original source identity.
