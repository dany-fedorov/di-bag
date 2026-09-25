# Naming evidence

## Vocabulary

| Concept | Word | Retired words |
| --- | --- | --- |
| Releasing a value | disposal | cleanup |
| Scope | child container | scope, child scope |
| Legacy call | current call | `build` |

## Elsewhere

This cleanup is not historical table evidence.
This `build` call is not historical table evidence.

## What the naming test checks

| Check | Rule | What fails |
| --- | --- | --- |
| `builder-method-prefix` | 3 | A method that does not start with `build` |
