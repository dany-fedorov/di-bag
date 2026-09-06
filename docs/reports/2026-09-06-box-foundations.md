# Box foundations: verified milestone

Date: 2026-09-06. This completes B1 and B2 of the enterprise design, not the
remaining enterprise DI program. No remote push, publication, or credential
storage was performed. Both independent checkouts retain local feature branches.

## Revisions and artifacts

| Library | Checkout / branch | Baseline | Verified HEAD |
|---|---|---|---|
| sas-box | `.related-repos/sas-box`, `feat/enterprise-foundations` | `105c796cebaabb08127674b118bf1e4665f15d6f` | `b895f9d1f1d168992f44e9f46025bc1ac9d26e14` |
| val-box | `.related-repos/val-box`, `feat/enterprise-foundations` | `9da16d922883accdb09a4ffc53267911887ab07b` | `07506fcb3e49f460b6de357ecad7d88262a7f32d` |

The sas-box foundation commit is `6c640bf4c8a1c6a7d2c5bc38b8971f4ed8025273`;
the final commit corrects generic constructor compatibility and makes emitted
declaration tests explicitly build their inputs. Both packages target `0.1.0`.
Registry checks found those versions unused; that is not a reservation.

Latest verified archives, retained locally under temporary storage:

- sas-box: `/tmp/sas-box-final-fix.v8tBbl/sas-box-0.1.0.tgz`.
  SHA-512: `1df071c09f98ae59141986622f174a1180d28835acd4aef2d7aac5339e5e5debfeb4d9c5de9f32d87181f92183c3a18af1ac4b84a4baec43971b3aec62d329db`.
- val-box: `/tmp/val-box-artifacts.POQWLl/val-box-0.1.0.tgz`.
  SHA-512: `3e4a4b9fbdb39523eab607f2f758e65fa86e919251655ca31e4905c2c4e3c12c3f214a54f64a4929ce01abac7d2ee92df105e51e614c4831d356c8c669cc7ed8`.

Archives can be regenerated with each checkout's `npm pack` command if temporary
storage is removed. Reverify any regenerated or subsequently changed artifact
before publishing. `PUBLISHING.md` in each checkout documents authentication,
version checks, test/build/pack, and an explicit local publish command; there
is no automatic publication script.

## Evidence

- Environment: Node 24.20.0, Bun 1.4.0, TypeScript 5.9.3.
- Fresh independent sas-box `npm run check`: 17 tests passed, 0 failed,
  41 assertions; strict typecheck and build passed on the final committed tree.
- Fresh independent val-box `npm run check`: 23 tests passed, 0 failed,
  100 assertions; strict typecheck and build passed on the final committed tree.
- Both real archives were inspected: only license, README, package manifest,
  JavaScript output, and declarations. Sas-box has five entries, val-box seven.
- Installed CJS/ESM consumers passed, preserving original Promise identity,
  fulfilled async values, callback error identity, conversions, presence,
  aliases, snapshot isolation, and shared unfrozen payloads as applicable.
- The controller's installed sas-box declaration consumer accepts all three
  previously failing generic constructor forms, preserves exact `T` versus
  `Promise<Awaited<T>>`, and rejects incompatible dual callbacks.
- The controller's installed val-box declaration consumer preserves generic
  structural snapshot inference, presence narrowing, and readonly contracts.
- Task reviews approved both libraries. Final cross-package review found one
  Important generic-constructor regression and one Minor stale-declaration-test
  risk in sas-box. One fix wave addressed both; scoped re-review found no new
  breakage or outstanding findings.

The process sandbox required approved escalation for Bun-launched Node consumers.
Those checks were actually executed; they are not CI-only or inferred claims.

## Architectural outcome

Sas-box remains an acquisition-capability library, without global memoization or
resource ownership. Sync access returns raw `T`; async access normalizes to
`Promise<Awaited<T>>`, including callback throws and structural thenables.

Val-box preserves its mutable compatibility API with corrected conversion and
presence semantics. Both snapshot entry points delegate to one structurally
typed, shallow immutable boundary. Present `undefined` differs from absence;
payload identity and ownership remain unchanged. These boundaries prepare real
optional DI adapters; those adapters are not implemented by this milestone.

## Rulings made during this milestone

1. Continue in `feat/v0.1` and create feature branches in the two independent
   checkouts, without creating another worktree. The user requested continuous
   work in this repo. Cost if wrong: move unmerged local commits to a worktree.
2. Treat the user's explicit plan-then-IMPLEMENT instruction as approval for
   continuous execution of the preceding architectural direction, without a
   second spec-approval pause. Cost if wrong: reviewable API/design rework;
   publication and remote mutation remain separately unauthorized.
3. Add instance `box.snapshot()` alongside `ValBox.snapshot(box)` to preserve
   value/metadata generics through a structural DI adapter protocol. Cost if
   wrong: one redundant public convenience method to maintain.
4. Keep local branches and ignored review evidence while the wider program
   continues; defer integration menus and scratch cleanup until the final
   handoff. Cost if wrong: small ignored scratch storage and a later manual
   integration choice. No merge, push, or deletion was inferred.
