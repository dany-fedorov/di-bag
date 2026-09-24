import { DiBag } from '../../../src';
import type { Provider } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), bridge: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }), root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const key: unique symbol = Symbol('db');
const dbToken = DiBag.createToken(key).forService<number>();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(dbToken, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ root: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [dbToken], factoryFunction: db => db }), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(dbToken, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ bridge: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [dbToken], factoryFunction: db => db }), lifetime: 'transient:one-per-resolve' }), root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const privateCollision = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), bridge: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateCollision]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }), root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const renamed = DiBag.createBuilder().withServices({ bridge: DiBag.providerWithLifetime({ provider: ({ external }: { external: number }) => external, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['bridge'] }).withRenamedExport({ currentExportKey: 'bridge', newExportKey: 'external' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([renamed]).withReplacedService('external', DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ root: DiBag.providerWithLifetime({ provider: ({ external }: { external: number }) => external, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const privateRootBuilder = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), hidden: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }), api: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
privateRootBuilder.buildModule({ exportedServiceKeys: ['api'] });

const exportlessBuilder = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), hidden: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
exportlessBuilder.buildModule({ exportedServiceKeys: [] });

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), permissive: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: true }), a: DiBag.providerWithLifetime({ provider: ({ permissive }: { permissive: number }) => permissive, lifetime: 'singleton:one-per-container-tree' }), c: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), a: DiBag.providerWithLifetime({ provider: ({ b, db }: { b: number; db: number }): number => b + db, lifetime: 'transient:one-per-resolve' }), b: DiBag.providerWithLifetime({ provider: ({ a }: { a: number }): number => a, lifetime: 'transient:one-per-resolve' }), root: DiBag.providerWithLifetime({ provider: ({ a }: { a: number }) => a, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const valid = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
valid.createIndependentContainer(['db'], { db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });

declare const bool: boolean;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: bool }) }).buildContainer();

declare const policy: 'root' | 'transient';
// diagnostic: lifetime requires an individually known policy literal
DiBag.providerWithLifetime({ provider: () => 1, lifetime: policy });

const union = Math.random() ? DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) : DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'scoped:one-per-container' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: union }).buildContainer();
const unionModule = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), bridge: Math.random() ? DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }) : DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([unionModule]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }), root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

declare const opaque: ProviderBase;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().withServices({ opaque: DiBag.providerWithLifetime({ provider: opaque, lifetime: 'singleton:one-per-container-tree' }) });
declare const erased: Provider<() => number>;
DiBag.createBuilder().withServices({ db: erased, root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: not assignable
const erasedRoot: Provider<() => number> = DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
void erasedRoot;

const exportedTransient = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), bridge: DiBag.providerWithLifetime({ provider: ({ db, external }: { db: number; external: number }) => db + external, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['db', 'bridge'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'external' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([exportedTransient]).withServices({ root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const privateToken = DiBag.createBuilder().withTokenService(dbToken, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withServices({ bridge: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [dbToken], factoryFunction: db => db }), lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['bridge'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateToken]).withTokenService(dbToken, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' })).withServices({ root: DiBag.providerWithLifetime({ provider: ({ bridge }: { bridge: number }) => bridge, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const tokenRoot = DiBag.createBuilder().withTokenService(dbToken, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' })).withServices({ root: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [dbToken], factoryFunction: value => value }), lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
tokenRoot.createIndependentContainer([dbToken], { [key]: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });

const mixedExport = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), api: Math.random() ? DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) : DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([mixedExport]).buildContainer();
declare const noInferUnion: NoInfer<typeof union>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: noInferUnion }).buildContainer();

declare const mixedOpaque: NoInfer<ProviderBase | typeof union>;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: mixedOpaque, lifetime: 'singleton:one-per-container-tree' }) });

const renamePrivateRoot = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), hidden: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: ['db'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'database' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([renamePrivateRoot]).buildContainer();

const wrappedUnion = DiBag.providerWithRegistrationMetadata({ provider: union, registrationMetadata: {} });
const wrappedUnionModule = DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), api: wrappedUnion }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([wrappedUnionModule]).buildContainer();

const sameName = DiBag.createBuilder().withServices({ local: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }), api: DiBag.providerWithLifetime({ provider: ({ local }: { local: number }) => local, lifetime: 'transient:one-per-resolve' }), db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['api'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([sameName]).withServices({ local: DiBag.providerWithLifetime({ provider: ({ api }: { api: number }) => api, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

const firstContext = DiBag.createBuilder().withServices({ hop: DiBag.providerWithLifetime({ provider: ({ second }: { second: number }) => second, lifetime: 'transient:one-per-resolve' }), first: DiBag.providerWithLifetime({ provider: ({ hop }: { hop: number }) => hop, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['first'] });
const secondContext = DiBag.createBuilder().withServices({ hop: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }), second: DiBag.providerWithLifetime({ provider: ({ hop }: { hop: number }) => hop, lifetime: 'transient:one-per-resolve' }), db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['second'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([firstContext]).withInstalledModules([secondContext]).withServices({ root: DiBag.providerWithLifetime({ provider: ({ first }: { first: number }) => first, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ missing, db }: { missing: number; db: number }) => missing + db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: string }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
// diagnostic: not assignable
DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'unknown' });
declare const unknownPolicy: string;
// diagnostic: not assignable
DiBag.providerWithLifetime({ provider: () => 1, lifetime: unknownPolicy });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithTransformedService({ provider: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }), transformService: value => value, callbackReceives: 'fulfilled-value' }) }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithDisposal({ provider: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }), disposeService: () => {} }) }).buildContainer();

declare const optionalCapture: { allowsScopedDependencies: true } | undefined;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree', ...optionalCapture }) }).buildContainer();
declare const optionalField: { allowsScopedDependencies?: true };
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree', ...optionalField }) }).buildContainer();
// diagnostic: Property 'allowsScopedDependencies' is missing
DiBag.providerWithLifetime<() => number, 'singleton:one-per-container-tree', { allowsScopedDependencies: true }>({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' });
// diagnostic: allowsScopedDependencies
DiBag.providerWithLifetime<() => number, 'singleton:one-per-container-tree', { allowsScopedDependencies: true }>({ provider: () => 1, lifetime: 'singleton:one-per-container-tree', extra: true });

const retainedShape = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: ({ host }: { host: string }) => host, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([retainedShape]).withServices({ host: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
const retainedMissing = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: ({ missing, db }: { missing: number; db: number }) => missing + db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([retainedMissing]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: string }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: ['root'] })]).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ db }: { db: string }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
