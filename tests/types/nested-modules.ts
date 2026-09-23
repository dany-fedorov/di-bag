import { DiBag, type ModuleRequiredServices, type ModuleExportedServices, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';

const withLifetime = DiBag.withLifetime;

// A module installed inside a module: needs satisfied privately are final, needs
// satisfied by an export stay checkable, and unmet needs are forwarded outward.
const inner = DiBag.createBuilder().withServices({
  connection: () => ({ open: true }),
  service: ({ connection, logger, clock }: { connection: { open: boolean }; logger: { log(message: string): void }; clock: { now(): number } }) =>
    ({ read: () => connection.open, stamp: () => clock.now(), log: (message: string) => logger.log(message) }),
}).buildModule({ exportedServiceKeys: ['service'] });
type InnerRequired = Assert<Equal<ModuleRequiredServices<typeof inner>, Readonly<{ logger: { log(message: string): void }; clock: { now(): number } }>>>;

const outer = DiBag.createBuilder()
  .withInstalledModules([inner])
  .withServices({ logger: () => ({ log(_message: string) {} }) })
  .withServices({ view: ({ service }: { service: { read(): boolean } }) => service.read() })
  .buildModule({ exportedServiceKeys: ['service', 'view'] });
type OuterRequired = Assert<Equal<ModuleRequiredServices<typeof outer>, Readonly<{ clock: { now(): number } }>>>;
type OuterExported = Assert<Equal<keyof ModuleExportedServices<typeof outer>, 'service' | 'view'>>;

// The host may use the private name `logger` with any shape: the inner need was satisfied inside `outer`.
export const host = DiBag.createBuilder()
  .withInstalledModules([outer])
  .withServices({ clock: () => ({ now: () => 1 }), logger: () => 'a host string, unrelated to the private logger' })
  .buildContainer();
export const view = host.resolve('view');
export const service = host.resolve('service');
type HostExact = [Assert<Equal<typeof view, boolean>>, Assert<Equal<ReturnType<typeof service.stamp>, number>>];

// A need satisfied by an outer export remains a checked constraint after nesting and renaming.
const exported = DiBag.createBuilder()
  .withInstalledModules([inner])
  .withServices({ logger: () => ({ log(_message: string) {}, level: 1 }) })
  .buildModule({ exportedServiceKeys: ['service', 'logger'] })
  .withRenamedExport({ currentExportKey: 'logger', newExportKey: 'sink' });
type ExportedRequired = Assert<Equal<ModuleRequiredServices<typeof exported>, Readonly<{ clock: { now(): number } }>>>;
export const compatible = DiBag.createBuilder()
  .withInstalledModules([exported])
  .withServices({ clock: () => ({ now: () => 2 }) })
  .withReplacedService('sink', () => ({ log(_message: string) {}, level: 2 }))
  .buildContainer();

// Three levels forward the same requirement; each level re-scopes constraints once.
const middle = DiBag.createBuilder().withInstalledModules([inner]).withServices({ logger: () => ({ log(_message: string) {} }) }).buildModule({ exportedServiceKeys: ['service'] });
const top = DiBag.createBuilder().withInstalledModules([middle]).withServices({ top: ({ service }: { service: { read(): boolean } }) => service.read() }).buildModule({ exportedServiceKeys: ['top'] });
type TopRequired = Assert<Equal<ModuleRequiredServices<typeof top>, Readonly<{ clock: { now(): number } }>>>;
export const topHost = DiBag.createBuilder().withInstalledModules([top]).withServices({ clock: () => ({ now: () => 3 }) }).buildContainer();
type TopExact = Assert<Equal<ReturnType<typeof topHost.resolve<'top'>>, boolean>>;

// Token needs forward the same way.
const clockKey = Symbol('clock');
const clockToken = DiBag.token(clockKey).of<{ now(): number }>();
const tokenInner = DiBag.createBuilder().withServices({ stamp: DiBag.fromFunction([clockToken], clock => clock.now()) }).buildModule({ exportedServiceKeys: ['stamp'] });
const tokenOuter = DiBag.createBuilder().withInstalledModules([tokenInner]).buildModule({ exportedServiceKeys: ['stamp'] });
type TokenRequired = Assert<Equal<ModuleRequiredServices<typeof tokenOuter>, Readonly<{ [clockKey]: { now(): number } }>>>;
export const tokenHost = DiBag.createBuilder().withInstalledModules([tokenOuter]).withTokenService(clockToken, () => ({ now: () => 4 })).buildContainer();
type TokenExact = Assert<Equal<ReturnType<typeof tokenHost.resolve<'stamp'>>, number>>;

// Root lifetimes inside nested modules are accepted when their dependencies are roots at every level.
const rootInner = DiBag.createBuilder().withServices({
  db: withLifetime(() => 1, 'root'),
  cache: withLifetime(({ db }: { db: number }) => db, 'root'),
}).buildModule({ exportedServiceKeys: ['cache'] });
const rootOuter = DiBag.createBuilder().withInstalledModules([rootInner]).withServices({
  api: withLifetime(({ cache }: { cache: number }) => cache, 'root'),
}).buildModule({ exportedServiceKeys: ['api'] });
export const rootHost = DiBag.createBuilder().withInstalledModules([rootOuter]).buildContainer();

// Nested contributions are projected through every level.
const groupKey = Symbol('group');
const group = DiBag.token(groupKey).forCollectionOf<number>();
const contributing = DiBag.createBuilder().withServices({ hidden: () => 1 }).withCollectionContribution({ collectionToken: group, provider: ({ hidden }: { hidden: number }) => hidden }).buildModule({ exportedServiceKeys: [] });
const wrapped = DiBag.createBuilder().withInstalledModules([contributing]).withCollectionContribution({ collectionToken: group, provider: () => 2 }).buildModule({ exportedServiceKeys: [] });
type WrappedContributions = Assert<Equal<ModuleContributions<typeof wrapped>, Readonly<{ [groupKey]: readonly number[] }>>>;
export const contributionHost = DiBag.createBuilder().withInstalledModules([wrapped]).buildContainer();
type ContributionExact = Assert<Equal<ReturnType<typeof contributionHost.resolveCollection<typeof group>>, readonly number[]>>;
