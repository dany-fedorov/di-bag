# di-bag-codemod

Moves code written for [DI Bag](https://github.com/dany-fedorov/di-bag) 0.4 to
the 0.5 API. It uses the TypeScript checker to authenticate calls, properties,
contextually typed object keys, and exported type references as DI Bag uses.
Argument values are rewritten only within those authenticated uses. Runtime
`DI_BAG_*` strings and module specifiers follow explicit exact or suffix rules
in the rename map; they do not depend on declaration resolution. Ordinary uses
such as `text.replace(...)`, `Promise.all(...)`, and your own `register` method
are left alone.

Run it **before** you upgrade, while `di-bag` 0.4 is still installed: every
type-based decision reads the old declarations.

## Commands

```sh
npx di-bag-codemod                          # dry run over ./tsconfig.json
npx di-bag-codemod --write                  # apply
npx di-bag-codemod --project tsconfig.app.json --write --report codemod-report.json
npx di-bag-codemod src/app.ts src/worker.ts # explicit files instead of a project
```

Pass either `--project <tsconfig>` or positional source files. Passing both is
a usage error; use repeatable `--extra-files` to add files excluded by a
tsconfig. Without either input form, `./tsconfig.json` is used. A run prints one
line per changed file, one entry per manual item, and a summary:

```text
would rewrite src/app.ts: 3 rewrites
manual src/app.ts:41:52 startupOrder is not a literal; use maxConcurrentServiceKeys: omit it for 'parallel', 1 for 'sequential', or the number
       startupOrder: order
1 files, 3 rewrites, 1 manual items (dry run; pass --write to apply) (TypeScript 6.0.3, project)
```

| Option | Meaning |
| --- | --- |
| `--write` | Write the rewritten files. Without it nothing changes on disk. |
| `--report <file>` | Write the changed files and complete manual items as JSON. |
| `--extra-files <glob>` | Add files the tsconfig excludes. Repeatable. `*`, `**`, and `?` are supported. |
| `--library-root <dir>` | Treat declarations under this directory as DI Bag. Repeatable. Without this option, installed `node_modules/di-bag` declarations are recognized automatically; when supplied, only the listed roots count. |
| `--map <file>` | Use a rename map other than the one in this package. |
| `--help`, `-h` | Print command usage. |

Exit codes: `0` means the run finished, with or without manual items; `2` means
a usage, tsconfig, or rename-map error.

## Manual items

The codemod never guesses. What it cannot decide from the original program it
leaves unchanged and reports with file, line, column, reason, and source text:

- options that are not an object literal, or that contain a spread;
- a string value that is not a literal;
- a method referenced or destructured without being called when its arguments
  change shape;
- a call with a spread argument;
- a receiver of type `any`;
- a runtime code split into several replacements, and an old code inside a
  regular expression, template, or comment;
- a re-export of a renamed name, which keeps its old public name.

Fix these by hand, then run the compiler.

## The rename map

`rename-map.json` describes the distance from 0.4.0 to the current API.
`rename-map.schema.json` documents every field.
Method and property targets must be bare ASCII identifiers. Type targets have
the same form and cannot be TypeScript keywords or primitive type names. Keys
emitted inside options bags may contain other characters and are quoted safely.

| Section | Rewrites |
| --- | --- |
| `methods` | a method name, its arguments into one options bag or an array, or a custom transform |
| `options` | a key of an object-literal argument, by argument position and path |
| `values` | a string at an argument path, or a string compared with or assigned to a library property |
| `properties` | a property of a library type: access, destructuring, and keys of contextually typed object literals |
| `types` | an exported class, interface, type alias, or error class in imports and references |
| `codes` | an exact `DI_BAG_*` runtime code in a string literal |
| `imports` | an exact module specifier or a suffix of a relative module specifier |

An owner is the original declaration that holds the member: `Builder`, `Bag`,
`DiBagApi`, or `StartupOptions`. A type written inline in a signature belongs
to that function, such as `fromFactory()`, or method, such as
`Bag.createScope()`. A custom method transform reads emitted method and existing
property names from the map. Its optional `transformNames` object supplies
role-based names for fields that had no declaration in 0.4.

## Limits

The tool rewrites TypeScript and TSX files in the selected program. It does not
read Markdown, generated source held in strings, or JavaScript without types.
It preserves formatting and does not run a formatter.

When the project provides a `typescript` package with compiler API version
6.0.3 or later, the codemod uses that project compiler. If no project compiler
can be resolved, it is older, or it lacks the required JavaScript compiler API,
the codemod uses its bundled TypeScript and identifies the choice in the summary.
