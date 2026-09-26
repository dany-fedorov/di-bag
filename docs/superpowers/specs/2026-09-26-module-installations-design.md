# Readable module labels and installation structure

## Approved scope

Issue #42 is addressed with a read-only module label and explicit installation
records in graph snapshots. String service keys and module labels continue to
accept `/`. Binding labels remain human-readable diagnostics, with their current
format; they are not unique identifiers or a serialization of installation ancestry.

## Public contract

```ts
// Module
get moduleLabel(): string | undefined;

export interface ModuleInstallationSnapshot {
  readonly installationId: symbol;
  readonly moduleLabel: string | undefined;
  readonly parentInstallationId: symbol | undefined;
}

// GraphSnapshot
readonly moduleInstallations: readonly ModuleInstallationSnapshot[];

// BindingSnapshot
readonly moduleInstallationId: symbol | undefined;
```

The label is exactly the value supplied at sealing, including `undefined` for an
unlabelled module. Both rename views preserve it. Reading it performs no service
acquisition. The instance stays frozen and the property has no setter.

An installation is one occurrence of a sealed module in a builder graph. Every
installation has an identity even when unlabelled, empty, or exporting all its
bindings. Records appear in installation order, parent before descendants, with
nested records contiguous. The list includes empty installations and installations
whose original bindings have all been replaced: it records graph composition,
not the number of surviving original bindings.

A binding points to the innermost installation that introduced that binding.
Host registrations have `undefined`. Following the record's parent gives the
enclosing installation chain. Exports, token bindings, and contributions retain
their origin. An alias records the origin of its own declaration, independent of
its target. A replacement is a new binding originating at the builder/container
where the replacement occurs; a host replacement therefore has `undefined`.
Existing bindings retained for lexical dependencies keep their original origin.

Installing a module creates fresh IDs for that installation and every nested
installation, using one remapping shared by all incoming bindings. Installing the
same module twice never shares installation IDs between the occurrences.
Sealing or renaming a module does not itself add an installation.

Building containers repeatedly from the same builder, taking more snapshots,
and creating child/independent containers preserve IDs of inherited graph
declarations, just as they preserve binding IDs. New installations alone mint
installation IDs. Acquisition ownership and container identity are separate.

The snapshot array and records are frozen. There are no live mutable collections,
module objects, providers, or acquired services in installation records.

## Implementation boundaries

Store installation records in `BindingGraph` with persistent append storage;
ordinary registration/copy operations must not scan or copy all installation
records. Carry them through `GraphDescription`, module installation remapping,
and container graph derivation. Snapshot enumeration may materialize the list.
Internal graph descriptions may use optional new fields so existing internal
fixtures remain valid; public snapshot fields are always present.

Expose origin on `BindingSnapshot` only in this change. `serviceSnapshot` and
observer payloads keep their existing shape; graph bindings already provide IDs
for joining those APIs. Export the new public type from `src/index.ts`.

No new error codes, name restrictions, dependencies, version bump, module IDs,
global installation registry, or changes to resolution/disposal semantics.

## Verification

Regression tests cover labelled/unlabelled and renamed modules, all original
issue examples, empty and repeated/nested installations, aliases, tokens,
contributions, host replacements, child and independent containers, stable
snapshot IDs, snapshot immutability, and lazy acquisition. Compiler checks
exercise read-only declarations and the exported snapshot type. Existing module,
inspection, alias, lifetime, persistent-graph, and full test lanes must pass.
Regenerate reference docs and run the documentation checks.
