import { DiBag, type Bag, type DisposableFactory } from '../../src';
import type { Assert, Equal } from './assert';

const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
const actual = { a: () => 3, b: () => 'wrong', other: false };
const narrowed: { a: () => number } = actual;
const child = root.fork(['a'], narrowed);
type Untouched = Assert<Equal<ReturnType<typeof child.resolve<'b'>>, number>>;
const selected = root.fork(['a', 'b'], { a: () => 3, b: () => 4, ignored: true });
type Selected = Assert<Equal<ReturnType<typeof selected.resolve<'a'>>, number>>;
const empty: typeof root = root.fork();
const noSelection: typeof root = root.fork([], { ignored: 'not a factory' });
const keys = ['a', 'b'] as const;
const fromConstTuple = root.fork(keys, { a: () => 5, b: () => 6 });
type FromConstTuple = Assert<Equal<ReturnType<typeof fromConstTuple.resolve<'b'>>, number>>;

const extended = DiBag.begin().add({
  clock: () => ({ now: () => 42 }),
  service: ({ clock }: { clock: { now(): number } }) => clock.now(),
}).replace('clock', () => ({ now() { return 7; }, scope() { return 'batch' as const; } })).end();
type Extended = Assert<Equal<ReturnType<typeof extended.resolve<'clock'>>, { now(): number; scope(): 'batch' }>>;

const changed = DiBag.begin()
  .add({ a: () => 1, result: ({ later }: { later: string }) => later })
  .replace('a', () => ({ label() { return 'ready' as const; } }))
  .add({ later: () => 'later' })
  .end();
type Changed = Assert<Equal<ReturnType<typeof changed.resolve<'a'>>, { label(): 'ready' }>>;

const create = ({ a }: { a: number }) => ({ value: a, increment() { return ++this.value; } });
const owned = DiBag.withDisposal(create, value => { value.increment(); });
type ExactCreate = Assert<Equal<typeof owned.create, typeof create>>;
const annotated: DisposableFactory<typeof create> = owned;
const ownedBag = DiBag.begin().add({ a: () => 1, owned }).end();
type OwnedValue = Assert<Equal<ReturnType<typeof ownedBag.resolve<'owned'>>, ReturnType<typeof create>>>;
const acceptsBag = <R extends { a: () => number }>(bag: Bag<R>) => bag;
void [empty, noSelection, annotated, acceptsBag(root)];

const clockRoot = DiBag.begin().add({
  clock: () => ({ now: () => 42 }),
  service: ({ clock }: { clock: { now(): number } }) => ({
    stamp: () => clock.now(),
  }),
}).end();
const richChild = clockRoot.fork(['clock', 'service'], {
  clock: () => ({ now() { return 7; }, zone() { return 'utc' as const; } }),
  service: ({ clock }: { clock: { now(): number; zone(): 'utc' } }) => ({
    stamp() { return clock.now(); },
    zone() { return clock.zone(); },
  }),
});
type RichService = Assert<Equal<
  ReturnType<typeof richChild.resolve<'service'>>,
  { stamp(): number; zone(): 'utc' }
>>;
const ownedChild = clockRoot.fork(['clock'], {
  clock: DiBag.withDisposal(
    () => ({ now: () => 7 as const, scope() { return 'owned' as const; } }),
    value => { const scope: 'owned' = value.scope(); void scope; },
  ),
});
type OwnedClock = Assert<Equal<
  ReturnType<typeof ownedChild.resolve<'clock'>>,
  { now(): 7; scope(): 'owned' }
>>;
