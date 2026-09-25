# Naming evidence

## Vocabulary

| Concept | Word | Retired words |
| --- | --- | --- |
| Releasing a value | disposal | cleanup |
| Nested container | child container | scope, child scope |
| Legacy call | current call | `build` |
| Current wording | cleanup DI_BAG_CYCLE | cleanup |

## Elsewhere

This cleanup is not historical table evidence.
This `build` call is not historical table evidence.

## What the naming test checks

| Check | Rule | What fails |
| --- | --- | --- |
| `builder-method-prefix` | 3 | A method that does not start with `build` |
| `other-rule` | cleanup DI_BAG_CYCLE | current text |

## Measured exceptions

| Shape in the design note | Fallback taken | Measurement that forced it | Recorded in |
| --- | --- | --- | --- |
| `inspect` | cleanup DI_BAG_CYCLE | bag shape measured | ref |

## The rules

The bag owns every service.
