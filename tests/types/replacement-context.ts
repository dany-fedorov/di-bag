import { DiBag, type ModuleProvides } from '../../src';
import type { Assert, Equal } from './assert';

const consumed = DiBag.begin().add({
  clock: () => ({ now: () => 1, unused: () => false }),
  consumer: ({ clock }: { clock: { now(): number } }) => clock.now(),
}).replace('clock', () => ({ now() { return 7; }, scope() { return 'new' as const; } })).end();
type DroppedUnused = Assert<Equal<ReturnType<typeof consumed.resolve<'clock'>>, { now(): number; scope(): 'new' }>>;
const twoConsumers = DiBag.begin().add({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).replace('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).end();
type Intersection = Assert<Equal<ReturnType<typeof twoConsumers.resolve<'clock'>>, { now(): number; zone(): string; scope(): boolean }>>;
const unionConsumer = DiBag.begin().add({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value: { read(): number } | { read(): string } }) => value.read(),
}).replace('value', () => ({ read() { return 'new'; }, scope() { return true; } })).end();
type PreserveInnerUnion = Assert<Equal<ReturnType<typeof unionConsumer.resolve<'value'>>, { read(): string; scope(): boolean }>>;
const optionalConsumer = DiBag.begin().add({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } }) => value?.read(),
}).replace('value', () => ({ read() { return 7; }, scope() { return true; } })).end();
type PreserveOptional = Assert<Equal<ReturnType<typeof optionalConsumer.resolve<'value'>>, { read(): number; scope(): boolean }>>;
const explicitUndefined = DiBag.begin().add({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } | undefined }) => value?.read(),
}).replace('value', () => undefined).end();
type PreserveExplicitUndefined = Assert<Equal<ReturnType<typeof explicitUndefined.resolve<'value'>>, undefined>>;
const moduleLocal = DiBag.module().add({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).replace('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).exports(['clock']);
type ModuleIntersection = Assert<Equal<ModuleProvides<typeof moduleLocal>['clock'], { now(): number; zone(): string; scope(): boolean }>>;
const modulePrivate = DiBag.module().add({
  hidden: ({ clock }: { clock: { now(): number } }) => clock.now(),
  value: ({ hidden }: { hidden: number }) => hidden,
}).exports(['value']);
const privateHost = DiBag.begin().install(modulePrivate).add({
  clock: () => ({ now: () => 1, unused: () => false }),
}).replace('clock', () => ({ now() { return 7; }, scope() { return 'private' as const; } })).end();
type PrivateConstraint = Assert<Equal<ReturnType<typeof privateHost.resolve<'clock'>>, { now(): number; scope(): 'private' }>>;
const noSelf = DiBag.begin().add({
  self: ({ self }: { self: { old(): number } }) => ({ old: () => self.old() }),
}).replace('self', () => ({ fresh() { return true; } })).end();
type RemovedOldSelf = Assert<Equal<ReturnType<typeof noSelf.resolve<'self'>>, { fresh(): boolean }>>;

// Preserve baseline inline required/optional/default parameters and K,V generics.
const bagRequired = DiBag.begin().add({ dep: () => 1, service: () => 0 })
  .replace('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).end();
type BagRequired = Assert<Equal<ReturnType<typeof bagRequired.resolve<'service'>>, { read(): number; richer(): true }>>;
const moduleRequired = DiBag.module().add({ dep: () => 1, service: () => 0 })
  .replace('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).exports(['service']);
type ModuleRequired = Assert<Equal<ModuleProvides<typeof moduleRequired>['service'], { read(): number; richer(): true }>>;
const bagOptional = DiBag.begin().add({ dep: () => 1, service: () => 0 })
  .replace('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).end();
type BagOptional = Assert<Equal<ReturnType<typeof bagOptional.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const moduleOptional = DiBag.module().add({ dep: () => 1, service: () => 0 })
  .replace('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).exports(['service']);
type ModuleOptional = Assert<Equal<ModuleProvides<typeof moduleOptional>['service'], { read(): number | undefined; richer(): boolean }>>;
const bagDefault = DiBag.begin().add({ dep: () => 1, service: () => 0 })
  .replace('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).end();
type BagDefault = Assert<Equal<ReturnType<typeof bagDefault.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const moduleDefault = DiBag.module().add({ dep: () => 1, service: () => 0 })
  .replace('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).exports(['service']);
type ModuleDefault = Assert<Equal<ModuleProvides<typeof moduleDefault>['service'], { read(): number; richer(): boolean }>>;
type ExplicitFactory = (deps: { dep: number }) => { read(): number; richer(): boolean };
const explicitBag = DiBag.begin().add({ dep: () => 1, service: () => 0 })
  .replace<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).end();
type ExplicitBag = Assert<Equal<ReturnType<typeof explicitBag.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const explicitModule = DiBag.module().add({ dep: () => 1, service: () => 0 })
  .replace<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).exports(['service']);
type ExplicitModule = Assert<Equal<ModuleProvides<typeof explicitModule>['service'], { read(): number; richer(): boolean }>>;
type ExplicitOptionalFactory = (deps?: { dep: number }) => { read(): number | undefined; richer(): boolean };
const explicitOptionalBag = DiBag.begin().add({ dep: () => 1, service: () => 0 })
  .replace<'service', ExplicitOptionalFactory>('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).end();
type ExplicitOptionalBag = Assert<Equal<ReturnType<typeof explicitOptionalBag.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const explicitDefaultModule = DiBag.module().add({ dep: () => 1, service: () => 0 })
  .replace<'service', ExplicitOptionalFactory>('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).exports(['service']);
type ExplicitDefaultModule = Assert<Equal<ModuleProvides<typeof explicitDefaultModule>['service'], { read(): number | undefined; richer(): boolean }>>;
