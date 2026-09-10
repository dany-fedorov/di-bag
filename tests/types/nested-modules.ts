import { DiBag, type ModuleRequiredServices, type ModuleExportedServices, type ModuleContributions } from '../../src';
import type { Assert, Equal } from './assert';

const withLifetime = DiBag.withLifetime;

// A module installed inside a module: needs satisfied privately are final, needs
// satisfied by an export stay checkable, and unmet needs are forwarded outward.
const inner = DiBag.createBuilder().register({
  connection: () => ({ open: true }),
  service: ({ connection, logger, clock }: { connection: { open: boolean }; logger: { log(message: string): void }; clock: { now(): number } }) =>
    ({ read: () => connection.open, stamp: () => clock.now(), log: (message: string) => logger.log(message) }),
}).buildModule(['service']);
type InnerRequired = Assert<Equal<ModuleRequiredServices<typeof inner>, Readonly<{ logger: { log(message: string): void }; clock: { now(): number } }>>>;

const outer = DiBag.createBuilder()
  .installModule(inner)
  .register({ logger: () => ({ log(_message: string) {} }) })
  .register({ view: ({ service }: { service: { read(): boolean } }) => service.read() })
  .buildModule(['service', 'view']);
type OuterRequired = Assert<Equal<ModuleRequiredServices<typeof outer>, Readonly<{ clock: { now(): number } }>>>;
type OuterExported = Assert<Equal<keyof ModuleExportedServices<typeof outer>, 'service' | 'view'>>;

// The host may use the private name `logger` with any shape: the inner need was satisfied inside `outer`.
export const host = DiBag.createBuilder()
  .installModule(outer)
  .register({ clock: () => ({ now: () => 1 }), logger: () => 'a host string, unrelated to the private logger' })
  .build();
export const view = host.resolve('view');
export const service = host.resolve('service');
type HostExact = [Assert<Equal<typeof view, boolean>>, Assert<Equal<ReturnType<typeof service.stamp>, number>>];

// A need satisfied by an outer export remains a checked constraint after nesting and renaming.
const exported = DiBag.createBuilder()
  .installModule(inner)
  .register({ logger: () => ({ log(_message: string) {}, level: 1 }) })
  .buildModule(['service', 'logger'])
  .renameExport('logger', 'sink');
type ExportedRequired = Assert<Equal<ModuleRequiredServices<typeof exported>, Readonly<{ clock: { now(): number } }>>>;
export const compatible = DiBag.createBuilder()
  .installModule(exported)
  .register({ clock: () => ({ now: () => 2 }) })
  .replace('sink', () => ({ log(_message: string) {}, level: 2 }))
  .build();

// Three levels forward the same requirement; each level re-scopes constraints once.
const middle = DiBag.createBuilder().installModule(inner).register({ logger: () => ({ log(_message: string) {} }) }).buildModule(['service']);
const top = DiBag.createBuilder().installModule(middle).register({ top: ({ service }: { service: { read(): boolean } }) => service.read() }).buildModule(['top']);
type TopRequired = Assert<Equal<ModuleRequiredServices<typeof top>, Readonly<{ clock: { now(): number } }>>>;
export const topHost = DiBag.createBuilder().installModule(top).register({ clock: () => ({ now: () => 3 }) }).build();
type TopExact = Assert<Equal<ReturnType<typeof topHost.resolve<'top'>>, boolean>>;

// Token needs forward the same way.
const clockKey = Symbol('clock');
const clockToken = DiBag.token(clockKey).of<{ now(): number }>();
const tokenInner = DiBag.createBuilder().register({ stamp: DiBag.fromFunction([clockToken], clock => clock.now()) }).buildModule(['stamp']);
const tokenOuter = DiBag.createBuilder().installModule(tokenInner).buildModule(['stamp']);
type TokenRequired = Assert<Equal<ModuleRequiredServices<typeof tokenOuter>, Readonly<{ [clockKey]: { now(): number } }>>>;
export const tokenHost = DiBag.createBuilder().installModule(tokenOuter).register(clockToken, () => ({ now: () => 4 })).build();
type TokenExact = Assert<Equal<ReturnType<typeof tokenHost.resolve<'stamp'>>, number>>;

// Root lifetimes inside nested modules are accepted when their dependencies are roots at every level.
const rootInner = DiBag.createBuilder().register({
  db: withLifetime(() => 1, 'root'),
  cache: withLifetime(({ db }: { db: number }) => db, 'root'),
}).buildModule(['cache']);
const rootOuter = DiBag.createBuilder().installModule(rootInner).register({
  api: withLifetime(({ cache }: { cache: number }) => cache, 'root'),
}).buildModule(['api']);
export const rootHost = DiBag.createBuilder().installModule(rootOuter).build();

// Nested contributions are projected through every level.
const groupKey = Symbol('group');
const group = DiBag.token(groupKey).of<number>();
const contributing = DiBag.createBuilder().register({ hidden: () => 1 }).contribute(group, ({ hidden }: { hidden: number }) => hidden).buildModule([]);
const wrapped = DiBag.createBuilder().installModule(contributing).contribute(group, () => 2).buildModule([]);
type WrappedContributions = Assert<Equal<ModuleContributions<typeof wrapped>, Readonly<{ [groupKey]: readonly number[] }>>>;
export const contributionHost = DiBag.createBuilder().installModule(wrapped).build();
type ContributionExact = Assert<Equal<ReturnType<typeof contributionHost.resolveAll<typeof group>>, readonly number[]>>;
