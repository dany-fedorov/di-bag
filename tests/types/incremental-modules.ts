import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
import type { IncrementalConstraints } from '../../src/module-types';

const requirement = DiBag.createModuleBuilder().register({
  hidden: ({ value }: { value: number }) => value.toFixed(),
}).buildModule([]);
const values = DiBag.createModuleBuilder().register({ value: () => 1 }).buildModule(['value']);

export const left = DiBag.createBuilder().installModule(requirement).installModule(values).build();
export const right = DiBag.createBuilder().installModule(values).installModule(requirement).build();
export const result = right.resolve('value');
type Exact = Assert<Equal<typeof result, number>>;

const key = Symbol('value');
export const token = DiBag.token(key).of<number>();
const tokenNeed = DiBag.createModuleBuilder().register({
  hidden: DiBag.fromFunction([token], value => value),
}).buildModule([]);
export const tokenGraph = DiBag.createBuilder().installModule(tokenNeed).register(token, () => 1).build();
const optionalTokenNeed = DiBag.createModuleBuilder().register({
  hidden: DiBag.fromFunction([DiBag.optional(token)], value => value ?? 0),
}).buildModule([]);
export const optionalAbsent = DiBag.createBuilder().installModule(optionalTokenNeed).build();
export const optionalPresent = DiBag.createBuilder().register(token, () => 1).installModule(optionalTokenNeed).build();

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
