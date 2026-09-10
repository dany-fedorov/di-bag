#!/usr/bin/env bash
set -euo pipefail
review_root=/tmp/di-bag-replacement-projection-review
review_bun=/tmp/di-bag-bun-1.4.0/bun-linux-x64/bun
python "$review_root/setup.py"
for stage in semantic open declarations consumer; do
 for compiler in classic native; do
  flock /tmp/di-bag-compiler-heavy.lock "$review_bun" "$review_root/run.mjs" "$compiler" "$stage"
 done
done
python "$review_root/verify-results.py"
"$review_bun" "$review_root/markers.mjs"
