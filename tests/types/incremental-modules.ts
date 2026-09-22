import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';
import type { IncrementalConstraints } from '../../src/module-types';

const requirement = DiBag.createBuilder().withServices({
  hidden: ({ value }: { value: number }) => value.toFixed(),
}).buildModule({ exportedServiceKeys: [] });
const values = DiBag.createBuilder().withServices({ value: () => 1 }).buildModule({ exportedServiceKeys: ['value'] });

export const left = DiBag.createBuilder().withInstalledModules([requirement]).withInstalledModules([values]).buildContainer();
export const right = DiBag.createBuilder().withInstalledModules([values]).withInstalledModules([requirement]).buildContainer();
export const result = right.resolve('value');
type Exact = Assert<Equal<typeof result, number>>;

const key = Symbol('value');
export const token = DiBag.token(key).of<number>();
const tokenNeed = DiBag.createBuilder().withServices({
  hidden: DiBag.fromFunction([token], value => value),
}).buildModule({ exportedServiceKeys: [] });
export const tokenGraph = DiBag.createBuilder().withInstalledModules([tokenNeed]).withTokenService(token, () => 1).buildContainer();
const optionalTokenNeed = DiBag.createBuilder().withServices({
  hidden: DiBag.fromFunction([DiBag.optional(token)], value => value ?? 0),
}).buildModule({ exportedServiceKeys: [] });
export const optionalAbsent = DiBag.createBuilder().withInstalledModules([optionalTokenNeed]).buildContainer();
export const optionalPresent = DiBag.createBuilder().withTokenService(token, () => 1).withInstalledModules([optionalTokenNeed]).buildContainer();

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
