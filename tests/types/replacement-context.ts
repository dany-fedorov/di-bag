import { DiBag, type ModuleExportedServices } from '../../src';
import type { Assert, Equal } from './assert';

const consumed = DiBag.createBuilder().register({
  clock: () => ({ now: () => 1, unused: () => false }),
  consumer: ({ clock }: { clock: { now(): number } }) => clock.now(),
}).replace('clock', () => ({ now() { return 7; }, scope() { return 'new' as const; } })).build();
type DroppedUnused = Assert<Equal<ReturnType<typeof consumed.resolve<'clock'>>, { now(): number; scope(): 'new' }>>;
const twoConsumers = DiBag.createBuilder().register({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).replace('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).build();
type Intersection = Assert<Equal<ReturnType<typeof twoConsumers.resolve<'clock'>>, { now(): number; zone(): string; scope(): boolean }>>;
const unionConsumer = DiBag.createBuilder().register({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value: { read(): number } | { read(): string } }) => value.read(),
}).replace('value', () => ({ read() { return 'new'; }, scope() { return true; } })).build();
type PreserveInnerUnion = Assert<Equal<ReturnType<typeof unionConsumer.resolve<'value'>>, { read(): string; scope(): boolean }>>;
const optionalConsumer = DiBag.createBuilder().register({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } }) => value?.read(),
}).replace('value', () => ({ read() { return 7; }, scope() { return true; } })).build();
type PreserveOptional = Assert<Equal<ReturnType<typeof optionalConsumer.resolve<'value'>>, { read(): number; scope(): boolean }>>;
const explicitUndefined = DiBag.createBuilder().register({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } | undefined }) => value?.read(),
}).replace('value', () => undefined).build();
type PreserveExplicitUndefined = Assert<Equal<ReturnType<typeof explicitUndefined.resolve<'value'>>, undefined>>;
const moduleLocal = DiBag.createBuilder().register({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).replace('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).buildModule(['clock']);
type ModuleIntersection = Assert<Equal<ModuleExportedServices<typeof moduleLocal>['clock'], { now(): number; zone(): string; scope(): boolean }>>;
const modulePrivate = DiBag.createBuilder().register({
  hidden: ({ clock }: { clock: { now(): number } }) => clock.now(),
  value: ({ hidden }: { hidden: number }) => hidden,
}).buildModule(['value']);
const privateHost = DiBag.createBuilder().installModule(modulePrivate).register({
  clock: () => ({ now: () => 1, unused: () => false }),
}).replace('clock', () => ({ now() { return 7; }, scope() { return 'private' as const; } })).build();
type PrivateConstraint = Assert<Equal<ReturnType<typeof privateHost.resolve<'clock'>>, { now(): number; scope(): 'private' }>>;
const noSelf = DiBag.createBuilder().register({
  self: ({ self }: { self: { old(): number } }) => ({ old: () => self.old() }),
}).replace('self', () => ({ fresh() { return true; } })).build();
type RemovedOldSelf = Assert<Equal<ReturnType<typeof noSelf.resolve<'self'>>, { fresh(): boolean }>>;

// Preserve baseline inline required/optional/default parameters and K,V generics.
const bagRequired = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).build();
type BagRequired = Assert<Equal<ReturnType<typeof bagRequired.resolve<'service'>>, { read(): number; richer(): true }>>;
const moduleRequired = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).buildModule(['service']);
type ModuleRequired = Assert<Equal<ModuleExportedServices<typeof moduleRequired>['service'], { read(): number; richer(): true }>>;
const bagOptional = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).build();
type BagOptional = Assert<Equal<ReturnType<typeof bagOptional.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const moduleOptional = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).buildModule(['service']);
type ModuleOptional = Assert<Equal<ModuleExportedServices<typeof moduleOptional>['service'], { read(): number | undefined; richer(): boolean }>>;
const bagDefault = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).build();
type BagDefault = Assert<Equal<ReturnType<typeof bagDefault.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const moduleDefault = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).buildModule(['service']);
type ModuleDefault = Assert<Equal<ModuleExportedServices<typeof moduleDefault>['service'], { read(): number; richer(): boolean }>>;
type ExplicitFactory = (deps: { dep: number }) => { read(): number; richer(): boolean };
const explicitBag = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).build();
type ExplicitBag = Assert<Equal<ReturnType<typeof explicitBag.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const explicitModule = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).buildModule(['service']);
type ExplicitModule = Assert<Equal<ModuleExportedServices<typeof explicitModule>['service'], { read(): number; richer(): boolean }>>;
type ExplicitOptionalFactory = (deps?: { dep: number }) => { read(): number | undefined; richer(): boolean };
const explicitOptionalBag = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace<'service', ExplicitOptionalFactory>('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).build();
type ExplicitOptionalBag = Assert<Equal<ReturnType<typeof explicitOptionalBag.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const explicitDefaultModule = DiBag.createBuilder().register({ dep: () => 1, service: () => 0 }).replace<'service', ExplicitOptionalFactory>('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).buildModule(['service']);
type ExplicitDefaultModule = Assert<Equal<ModuleExportedServices<typeof explicitDefaultModule>['service'], { read(): number | undefined; richer(): boolean }>>;
