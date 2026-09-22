import { DiBag } from '../../../src';
const { withLifetime } = DiBag;
import type { Provider } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root') }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

const key: unique symbol = Symbol('db');
const dbToken = DiBag.token(key).of<number>();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(dbToken, () => 1).withServices({ root: withLifetime(DiBag.fromFunction([dbToken], db => db), 'root') }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(dbToken, () => 1).withServices({ bridge: withLifetime(DiBag.fromFunction([dbToken], db => db), 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

const privateCollision = DiBag.createBuilder().withServices({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient') }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateCollision]).withServices({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

const renamed = DiBag.createBuilder().withServices({ bridge: withLifetime(({ external }: { external: number }) => external, 'transient') }).buildModule({ exportedServiceKeys: ['bridge'] }).withRenamedExport({ currentExportKey: 'bridge', newExportKey: 'external' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([renamed]).withReplacedService('external', () => 1).withServices({ root: withLifetime(({ external }: { external: number }) => external, 'root') }).buildContainer();

const privateRootBuilder = DiBag.createBuilder().withServices({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root'), api: () => 1 });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
privateRootBuilder.buildModule({ exportedServiceKeys: ['api'] });

const exportlessBuilder = DiBag.createBuilder().withServices({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
exportlessBuilder.buildModule({ exportedServiceKeys: [] });

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, permissive: withLifetime(({ db }: { db: number }) => db, 'root', { allowScopedDependencies: true }), a: withLifetime(({ permissive }: { permissive: number }) => permissive, 'root'), c: withLifetime(({ db }: { db: number }) => db, 'root') }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, a: withLifetime(({ b, db }: { b: number; db: number }): number => b + db, 'transient'), b: withLifetime(({ a }: { a: number }): number => a, 'transient'), root: withLifetime(({ a }: { a: number }) => a, 'root') }).buildContainer();

const valid = DiBag.createBuilder().withServices({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ db }: { db: number }) => db, 'root') }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
valid.createIndependentContainer(['db'], { db: () => 1 });

declare const bool: boolean;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', { allowScopedDependencies: bool }) }).buildContainer();

// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'transient', { allowScopedDependencies: false });
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'scoped', { allowScopedDependencies: undefined });
declare const policy: 'root' | 'transient';
// diagnostic: lifetime requires an individually known policy literal
withLifetime(() => 1, policy);

const union = Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: union }).buildContainer();
const unionModule = DiBag.createBuilder().withServices({ db: () => 1, bridge: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'transient') : withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([unionModule]).withServices({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

declare const opaque: ProviderBase;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().withServices({ opaque: withLifetime(opaque, 'root') });
declare const erased: Provider<() => number>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: erased, root: withLifetime(({ db }: { db: number }) => db, 'root') }).buildContainer();
// diagnostic: not assignable
const erasedRoot: Provider<() => number> = withLifetime(() => 1, 'root');
void erasedRoot;

const exportedTransient = DiBag.createBuilder().withServices({ db: () => 1, bridge: withLifetime(({ db, external }: { db: number; external: number }) => db + external, 'transient') }).buildModule({ exportedServiceKeys: ['db', 'bridge'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'external' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([exportedTransient]).withServices({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

const privateToken = DiBag.createBuilder().withTokenService(dbToken, () => 1).withServices({ bridge: withLifetime(DiBag.fromFunction([dbToken], db => db), 'transient') }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateToken]).withTokenService(dbToken, withLifetime(() => 1, 'root')).withServices({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).buildContainer();

const tokenRoot = DiBag.createBuilder().withTokenService(dbToken, withLifetime(() => 1, 'root')).withServices({ root: withLifetime(DiBag.fromFunction([dbToken], value => value), 'root') }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
tokenRoot.createIndependentContainer([dbToken], { [key]: () => 1 });

const mixedExport = DiBag.createBuilder().withServices({ db: () => 1, api: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([mixedExport]).buildContainer();
declare const noInferUnion: NoInfer<typeof union>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: noInferUnion }).buildContainer();

declare const mixedOpaque: NoInfer<ProviderBase | typeof union>;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(mixedOpaque, 'root') });

const renamePrivateRoot = DiBag.createBuilder().withServices({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule({ exportedServiceKeys: ['db'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'database' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([renamePrivateRoot]).buildContainer();

const wrappedUnion = DiBag.withMetadata(union, { static: {} });
const wrappedUnionModule = DiBag.createBuilder().withServices({ db: () => 1, api: wrappedUnion }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([wrappedUnionModule]).buildContainer();

const sameName = DiBag.createBuilder().withServices({ local: withLifetime(({ db }: { db: number }) => db, 'transient'), api: withLifetime(({ local }: { local: number }) => local, 'transient'), db: () => 1 }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([sameName]).withServices({ local: withLifetime(({ api }: { api: number }) => api, 'root') }).buildContainer();

const firstContext = DiBag.createBuilder().withServices({ hop: withLifetime(({ second }: { second: number }) => second, 'transient'), first: withLifetime(({ hop }: { hop: number }) => hop, 'transient') }).buildModule({ exportedServiceKeys: ['first'] });
const secondContext = DiBag.createBuilder().withServices({ hop: withLifetime(({ db }: { db: number }) => db, 'transient'), second: withLifetime(({ hop }: { hop: number }) => hop, 'transient'), db: () => 1 }).buildModule({ exportedServiceKeys: ['second'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([firstContext]).withInstalledModules([secondContext]).withServices({ root: withLifetime(({ first }: { first: number }) => first, 'root') }).buildContainer();

// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).buildContainer();
// diagnostic: not assignable
withLifetime(() => 1, 'unknown');
declare const unknownPolicy: string;
// diagnostic: not assignable
withLifetime(() => 1, unknownPolicy);
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'root', { allowScopedDependencies: undefined });

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: DiBag.transformService(withLifetime(({ db }: { db: number }) => db, 'root'), { mode: 'awaited', transform: value => value }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: DiBag.withDisposal(withLifetime(({ db }: { db: number }) => db, 'root'), () => {}) }).buildContainer();

declare const unionCapture: Readonly<{}> | { allowScopedDependencies: false };
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'transient', unionCapture);
declare const unionUnknown: Readonly<{}> | { unsupported: true };
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'root', unionUnknown);

declare const optionalCapture: { allowScopedDependencies: true } | undefined;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalCapture) }).buildContainer();
declare const optionalField: { allowScopedDependencies?: true };
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalField) }).buildContainer();
// diagnostic: Expected 3 arguments
withLifetime<() => number, 'root', { allowScopedDependencies: true }>(() => 1, 'root');
// diagnostic: allowScopedDependencies
withLifetime<() => number, 'root', { allowScopedDependencies: true }>(() => 1, 'root', {});

const retainedShape = DiBag.createBuilder().withServices({ hidden: withLifetime(({ host }: { host: string }) => host, 'root') }).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([retainedShape]).withServices({ host: () => 1 }).buildContainer();
const retainedMissing = DiBag.createBuilder().withServices({ hidden: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([retainedMissing]).withServices({ db: () => 1 }).buildContainer();

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).buildModule({ exportedServiceKeys: ['root'] })]).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
