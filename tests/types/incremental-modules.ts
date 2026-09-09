import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
import type { IncrementalConstraints } from '../../src/module-types';

const requirement = DiBag.module().add({
  hidden: ({ value }: { value: number }) => value.toFixed(),
}).exports([]);
const values = DiBag.module().add({ value: () => 1 }).exports(['value']);

export const left = DiBag.begin().install(requirement).install(values).end();
export const right = DiBag.begin().install(values).install(requirement).end();
export const result = right.resolve('value');
type Exact = Assert<Equal<typeof result, number>>;

const key = Symbol('value');
export const token = DiBag.token(key).of<number>();
const tokenNeed = DiBag.module().add({
  hidden: DiBag.fromTokens([token], value => value),
}).exports([]);
export const tokenGraph = DiBag.begin().install(tokenNeed).bind(token, () => 1).end();
const optionalTokenNeed = DiBag.module().add({
  hidden: DiBag.fromTokens([DiBag.optional(token)], value => value ?? 0),
}).exports([]);
export const optionalAbsent = DiBag.begin().install(optionalTokenNeed).end();
export const optionalPresent = DiBag.begin().bind(token, () => 1).install(optionalTokenNeed).end();

type PlainRequirement = {
  readonly kind: 'external';
  readonly consumer: 'hidden';
  readonly needs: { value: number };
};
type IncrementalPlain = IncrementalConstraints<
  PlainRequirement,
  never,
  { existing: () => boolean },
  { value: () => number }
>;
type ConstraintAccepted = Assert<Equal<IncrementalPlain, unknown>>;
