import { DiBag, type Container } from '../../src';
import type { Assert, Equal } from './assert';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clocksKey = Symbol('clocks');
const clock = DiBag.createToken(clockKey).forService<Clock>();
const clocks = DiBag.createToken(clocksKey).forCollectionOf<Clock>();

const root = DiBag.createBuilder()
  .withServices({ value: () => 1, clock: (): Clock => ({ now: () => 1 }) })
  .withTokenService(clock, (): Clock => ({ now: () => 2 }))
  .withCollectionContribution({ collectionToken: clocks, provider: (): Clock => ({ now: () => 3 }) })
  .buildContainer();

export const emptyChild = root.createChildContainer();
export const emptyIndependent = root.createIndependentContainer();
export const emptyChildBag = root.createChildContainer({});
export const emptyIndependentBag = root.createIndependentContainer({});
export const inline = root.createIndependentContainer(
  ['clock'],
  { clock: ({ value }: { value: number }) => ({ now: () => value + 6, source: 'test' as const }) },
);
type Inline = Assert<Equal<ReturnType<typeof inline.resolve<'clock'>>, { now(): number; source: 'test' }>>;

const keys = ['value', clock] as const;
export const external = root.createIndependentContainer(
  keys,
  { value: () => 4, [clockKey]: ({ value }: { value: number }) => ({ now: () => value + 4 }) },
);
export const child = root.createChildContainer(
  [clocks],
  { [clocksKey]: ({ value }: { value: number }) => [{ now: () => value + 7 }] },
  { sharedParentServiceKeys: ['value'] },
);
const collection: readonly Clock[] = child.resolveCollection(clocks);
const annotation: Container<{ value: () => number }> = DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer();
void collection; void annotation; void emptyChildBag; void emptyIndependentBag;
export type { Inline };
