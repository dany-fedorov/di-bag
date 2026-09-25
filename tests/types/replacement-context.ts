import { DiBag, type ModuleExportedServices } from '../../src';
import type { Assert, Equal } from './assert';

const consumed = DiBag.createBuilder().withServices({
  clock: () => ({ now: () => 1, unused: () => false }),
  consumer: ({ clock }: { clock: { now(): number } }) => clock.now(),
}).withReplacedService('clock', () => ({ now() { return 7; }, scope() { return 'new' as const; } })).buildContainer();
type DroppedUnused = Assert<Equal<ReturnType<typeof consumed.resolve<'clock'>>, { now(): number; scope(): 'new' }>>;
const twoConsumers = DiBag.createBuilder().withServices({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).withReplacedService('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).buildContainer();
type Intersection = Assert<Equal<ReturnType<typeof twoConsumers.resolve<'clock'>>, { now(): number; zone(): string; scope(): boolean }>>;
const unionConsumer = DiBag.createBuilder().withServices({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value: { read(): number } | { read(): string } }) => value.read(),
}).withReplacedService('value', () => ({ read() { return 'new'; }, scope() { return true; } })).buildContainer();
type PreserveInnerUnion = Assert<Equal<ReturnType<typeof unionConsumer.resolve<'value'>>, { read(): string; scope(): boolean }>>;
const optionalConsumer = DiBag.createBuilder().withServices({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } }) => value?.read(),
}).withReplacedService('value', () => ({ read() { return 7; }, scope() { return true; } })).buildContainer();
type PreserveOptional = Assert<Equal<ReturnType<typeof optionalConsumer.resolve<'value'>>, { read(): number; scope(): boolean }>>;
const explicitUndefined = DiBag.createBuilder().withServices({
  value: () => ({ read: () => 1 }),
  consumer: ({ value }: { value?: { read(): number } | undefined }) => value?.read(),
}).withReplacedService('value', () => undefined).buildContainer();
type PreserveExplicitUndefined = Assert<Equal<ReturnType<typeof explicitUndefined.resolve<'value'>>, undefined>>;
const moduleLocal = DiBag.createBuilder().withServices({
  clock: () => ({ now: () => 1, zone: () => 'utc', unused: () => false }),
  first: ({ clock }: { clock: { now(): number } }) => clock.now(),
  second: ({ clock }: { clock: { zone(): string } }) => clock.zone(),
}).withReplacedService('clock', () => ({ now() { return 7; }, zone() { return 'eet'; }, scope() { return true; } })).buildModule({ exportedServiceKeys: ['clock'] });
type ModuleIntersection = Assert<Equal<ModuleExportedServices<typeof moduleLocal>['clock'], { now(): number; zone(): string; scope(): boolean }>>;
const modulePrivate = DiBag.createBuilder().withServices({
  hidden: ({ clock }: { clock: { now(): number } }) => clock.now(),
  value: ({ hidden }: { hidden: number }) => hidden,
}).buildModule({ exportedServiceKeys: ['value'] });
const privateHost = DiBag.createBuilder().withInstalledModules([modulePrivate]).withServices({
  clock: () => ({ now: () => 1, unused: () => false }),
}).withReplacedService('clock', () => ({ now() { return 7; }, scope() { return 'private' as const; } })).buildContainer();
type PrivateConstraint = Assert<Equal<ReturnType<typeof privateHost.resolve<'clock'>>, { now(): number; scope(): 'private' }>>;
const noSelf = DiBag.createBuilder().withServices({
  self: ({ self }: { self: { old(): number } }) => ({ old: () => self.old() }),
}).withReplacedService('self', () => ({ fresh() { return true; } })).buildContainer();
type RemovedOldSelf = Assert<Equal<ReturnType<typeof noSelf.resolve<'self'>>, { fresh(): boolean }>>;

// Preserve baseline inline required/optional/default parameters and K,V generics.
const bagRequired = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).buildContainer();
type BagRequired = Assert<Equal<ReturnType<typeof bagRequired.resolve<'service'>>, { read(): number; richer(): true }>>;
const moduleRequired = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', ({ dep }: { dep: number }) => ({ read() { return dep; }, richer() { return true; } })).buildModule({ exportedServiceKeys: ['service'] });
type ModuleRequired = Assert<Equal<ModuleExportedServices<typeof moduleRequired>['service'], { read(): number; richer(): true }>>;
const bagOptional = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).buildContainer();
type BagOptional = Assert<Equal<ReturnType<typeof bagOptional.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const moduleOptional = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).buildModule({ exportedServiceKeys: ['service'] });
type ModuleOptional = Assert<Equal<ModuleExportedServices<typeof moduleOptional>['service'], { read(): number | undefined; richer(): boolean }>>;
const bagDefault = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).buildContainer();
type BagDefault = Assert<Equal<ReturnType<typeof bagDefault.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const moduleDefault = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).buildModule({ exportedServiceKeys: ['service'] });
type ModuleDefault = Assert<Equal<ModuleExportedServices<typeof moduleDefault>['service'], { read(): number; richer(): boolean }>>;
type ExplicitFactory = (deps: { dep: number }) => { read(): number; richer(): boolean };
const explicitBag = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).buildContainer();
type ExplicitBag = Assert<Equal<ReturnType<typeof explicitBag.resolve<'service'>>, { read(): number; richer(): boolean }>>;
const explicitModule = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService<'service', ExplicitFactory>('service', ({ dep }) => ({ read() { return dep; }, richer() { return true; } })).buildModule({ exportedServiceKeys: ['service'] });
type ExplicitModule = Assert<Equal<ModuleExportedServices<typeof explicitModule>['service'], { read(): number; richer(): boolean }>>;
type ExplicitOptionalFactory = (deps?: { dep: number }) => { read(): number | undefined; richer(): boolean };
const explicitOptionalBag = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService<'service', ExplicitOptionalFactory>('service', (deps?: { dep: number }) => ({ read() { return deps?.dep; }, richer() { return true; } })).buildContainer();
type ExplicitOptionalBag = Assert<Equal<ReturnType<typeof explicitOptionalBag.resolve<'service'>>, { read(): number | undefined; richer(): boolean }>>;
const explicitDefaultModule = DiBag.createBuilder().withServices({ dep: () => 1, service: () => 0 }).withReplacedService<'service', ExplicitOptionalFactory>('service', ({ dep }: { dep: number } = { dep: 1 }) => ({ read() { return dep; }, richer() { return true; } })).buildModule({ exportedServiceKeys: ['service'] });
type ExplicitDefaultModule = Assert<Equal<ModuleExportedServices<typeof explicitDefaultModule>['service'], { read(): number | undefined; richer(): boolean }>>;
