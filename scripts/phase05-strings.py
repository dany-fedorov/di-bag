#!/usr/bin/env python3
"""Phase 4 (collection tokens): migrate call sites the codemod cannot read.

These five files hold library calls inside template strings, behind ``any``, or
in untyped JavaScript. Every replacement states how many times it must match;
any other count stops the script before a file is written. Run it from the
repository root. A second run changes nothing and reports that.
"""
import pathlib
import sys


EDITS = {
    'tests/contributions-runtime-fixture.ts': [
        ("const item = DiBag.token(itemKey).of();", "const item = DiBag.token(itemKey).forCollectionOf();\n    const singularItem = DiBag.token(Symbol('singular item')).of();", 1),
        (".register(item, () => ({ id: 'singular' }))", ".register(singularItem, () => ({ id: 'singular' }))", 1),
        ("ordered.resolve(item).id === 'singular'", "ordered.resolve(singularItem).id === 'singular'", 1),
        ("const lifetimeItem = DiBag.token(lifetimeKey).of();", "const lifetimeItem = DiBag.token(lifetimeKey).forCollectionOf();", 1),
        ("const promiseItem = DiBag.token(promiseKey).of();", "const promiseItem = DiBag.token(promiseKey).forCollectionOf();", 1),
        ("const retryItem = DiBag.token(retryKey).of();", "const retryItem = DiBag.token(retryKey).forCollectionOf();", 1),
        ("const portableItem = PortableContributionBag.token(portableKey).of();", "const portableItem = PortableContributionBag.token(portableKey).forCollectionOf();", 1),
        ("DiBag.all(lifetimeItem)", "lifetimeItem", 1),
        (".resolveAll(", ".resolveCollection(", 9),
        (".inspectAll(", ".inspectCollection(", 2),
    ],
    'tests/observers-runtime-fixture.ts': [
        ("const item = DiBag.token(itemKey).of();", "const item = DiBag.token(itemKey).forCollectionOf();", 1),
        (".resolveAll(", ".resolveCollection(", 2),
        (".inspectAll(", ".inspectCollection(", 1),
    ],
    'tests/plugins-runtime-fixture.ts': [
        ("const all = DiBag.token(allKey).of();", "const all = DiBag.token(allKey).forCollectionOf();", 1),
        ("DiBag.all(all)", "all", 1),
    ],
    'tests/final-adversarial-runtime-fixture.ts': [
        ("const i5Token = DiBag.token(Symbol('I5')).of();", "const i5Token = DiBag.token(Symbol('I5')).forCollectionOf();", 1),
        ("const i7Token = DiBag.token(Symbol('I7')).of();", "const i7Token = DiBag.token(Symbol('I7')).forCollectionOf();", 1),
        ("const i12Items = DiBag.token(Symbol('I12-items')).of();", "const i12Items = DiBag.token(Symbol('I12-items')).forCollectionOf();", 1),
        ("i5Observed.all(i5Token)", "i5Token", 1),
        ("i12Observed.all(i12Items)", "i12Items", 1),
        (".resolveAll(", ".resolveCollection(", 3),
        (".inspectAll(", ".inspectCollection(", 1),
    ],
    'tests/acquisition-retention.node.mjs': [
        ("const token = DiBag.token(Symbol('arrays')).of();", "const token = DiBag.token(Symbol('arrays')).forCollectionOf();", 1),
        (".resolveAll(", ".resolveCollection(", 1),
        (".inspectAll(", ".inspectCollection(", 1),
    ],
}


root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pending = {}
for name, edits in EDITS.items():
    path = root / name
    text = path.read_text()
    if all(old not in text for old, _new, _count in edits):
        print(f'{name}: already migrated')
        continue
    for old, new, count in edits:
        found = text.count(old)
        if found != count:
            sys.exit(f'{name}: expected {count} of {old!r}, found {found}. Nothing was written. Read the file and migrate it by hand.')
        text = text.replace(old, new)
    pending[path] = text
for path, text in pending.items():
    path.write_text(text)
    print(f'{path.relative_to(root)}: migrated')
leftovers = [f'{name}: {word}' for name in EDITS for word in ('resolveAll', 'inspectAll', '.all(')
             for line in (root / name).read_text().split('\n') if word in line and 'Promise.all(' not in line]
if leftovers:
    sys.exit('left over:\n' + '\n'.join(leftovers))
print('no resolveAll, inspectAll or all( is left in the five files')
