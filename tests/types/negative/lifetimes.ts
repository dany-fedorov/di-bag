import { DiBag } from '../../../src';
const { withLifetime } = DiBag;
import type { Provider } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root') }).build();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

const key: unique symbol = Symbol('db');
const dbToken = DiBag.token(key).of<number>();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register(dbToken, () => 1).register({ root: withLifetime(DiBag.fromFunction([dbToken], db => db), 'root') }).build();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register(dbToken, () => 1).register({ bridge: withLifetime(DiBag.fromFunction([dbToken], db => db), 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

const privateCollision = DiBag.createModuleBuilder().register({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient') }).buildModule(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateCollision).register({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

const renamed = DiBag.createModuleBuilder().register({ bridge: withLifetime(({ external }: { external: number }) => external, 'transient') }).buildModule(['bridge']).renameExport('bridge', 'external');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(renamed).replace('external', () => 1).register({ root: withLifetime(({ external }: { external: number }) => external, 'root') }).build();

const privateRoot = DiBag.createModuleBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root'), api: () => 1 }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).replace('api', withLifetime(() => 1, 'root')).build();

const exportless = DiBag.createModuleBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(exportless).build();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, permissive: withLifetime(({ db }: { db: number }) => db, 'root', { allowScopedDependencies: true }), a: withLifetime(({ permissive }: { permissive: number }) => permissive, 'root'), c: withLifetime(({ db }: { db: number }) => db, 'root') }).build();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, a: withLifetime(({ b, db }: { b: number; db: number }): number => b + db, 'transient'), b: withLifetime(({ a }: { a: number }): number => a, 'transient'), root: withLifetime(({ a }: { a: number }) => a, 'root') }).build();

const valid = DiBag.createBuilder().register({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ db }: { db: number }) => db, 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency
valid.fork(['db'], { db: () => 1 });

declare const bool: boolean;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', { allowScopedDependencies: bool }) }).build();

// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'transient', { allowScopedDependencies: false });
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'scoped', { allowScopedDependencies: undefined });
declare const policy: 'root' | 'transient';
// diagnostic: lifetime requires an individually known policy literal
withLifetime(() => 1, policy);

const union = Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: union }).build();
const unionModule = DiBag.createModuleBuilder().register({ db: () => 1, bridge: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'transient') : withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(unionModule).register({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

declare const opaque: ProviderBase;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().register({ opaque: withLifetime(opaque, 'root') });
declare const erased: Provider<() => number>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: erased, root: withLifetime(({ db }: { db: number }) => db, 'root') }).build();
// diagnostic: not assignable
const erasedRoot: Provider<() => number> = withLifetime(() => 1, 'root');
void erasedRoot;

const exportedTransient = DiBag.createModuleBuilder().register({ db: () => 1, bridge: withLifetime(({ db, external }: { db: number; external: number }) => db + external, 'transient') }).buildModule(['db', 'bridge']).renameExport('db', 'external');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(exportedTransient).register({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

const privateToken = DiBag.createModuleBuilder().register(dbToken, () => 1).register({ bridge: withLifetime(DiBag.fromFunction([dbToken], db => db), 'transient') }).buildModule(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateToken).register(dbToken, withLifetime(() => 1, 'root')).register({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).build();

const tokenRoot = DiBag.createBuilder().register(dbToken, withLifetime(() => 1, 'root')).register({ root: withLifetime(DiBag.fromFunction([dbToken], value => value), 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency
tokenRoot.fork([dbToken], { [key]: () => 1 });

const mixedExport = DiBag.createModuleBuilder().register({ db: () => 1, api: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(mixedExport).build();
declare const noInferUnion: NoInfer<typeof union>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: noInferUnion }).build();

declare const mixedOpaque: NoInfer<ProviderBase | typeof union>;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(mixedOpaque, 'root') });

const renamePrivateRoot = DiBag.createModuleBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule(['db']).renameExport('db', 'database');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(renamePrivateRoot).build();

const wrappedUnion = DiBag.withMetadata(union, { static: {} });
const wrappedUnionModule = DiBag.createModuleBuilder().register({ db: () => 1, api: wrappedUnion }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(wrappedUnionModule).build();

const sameName = DiBag.createModuleBuilder().register({ local: withLifetime(({ db }: { db: number }) => db, 'transient'), api: withLifetime(({ local }: { local: number }) => local, 'transient'), db: () => 1 }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(sameName).register({ local: withLifetime(({ api }: { api: number }) => api, 'root') }).build();

const firstContext = DiBag.createModuleBuilder().register({ hop: withLifetime(({ second }: { second: number }) => second, 'transient'), first: withLifetime(({ hop }: { hop: number }) => hop, 'transient') }).buildModule(['first']);
const secondContext = DiBag.createModuleBuilder().register({ hop: withLifetime(({ db }: { db: number }) => db, 'transient'), second: withLifetime(({ hop }: { hop: number }) => hop, 'transient'), db: () => 1 }).buildModule(['second']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(firstContext).installModule(secondContext).register({ root: withLifetime(({ first }: { first: number }) => first, 'root') }).build();

// diagnostic: required service registrations are missing
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).build();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).build();
// diagnostic: not assignable
withLifetime(() => 1, 'unknown');
declare const unknownPolicy: string;
// diagnostic: not assignable
withLifetime(() => 1, unknownPolicy);
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'root', { allowScopedDependencies: undefined });

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: DiBag.transformService(withLifetime(({ db }: { db: number }) => db, 'root'), { mode: 'awaited', transform: value => value }) }).build();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: DiBag.withDisposal(withLifetime(({ db }: { db: number }) => db, 'root'), () => {}) }).build();

declare const unionCapture: Readonly<{}> | { allowScopedDependencies: false };
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'transient', unionCapture);
declare const unionUnknown: Readonly<{}> | { unsupported: true };
// diagnostic: withLifetime allowScopedDependencies requires root
withLifetime(() => 1, 'root', unionUnknown);

declare const optionalCapture: { allowScopedDependencies: true } | undefined;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalCapture) }).build();
declare const optionalField: { allowScopedDependencies?: true };
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalField) }).build();
// diagnostic: Expected 3 arguments
withLifetime<() => number, 'root', { allowScopedDependencies: true }>(() => 1, 'root');
// diagnostic: allowScopedDependencies
withLifetime<() => number, 'root', { allowScopedDependencies: true }>(() => 1, 'root', {});

const retainedShape = DiBag.createModuleBuilder().register({ hidden: withLifetime(({ host }: { host: string }) => host, 'root') }).buildModule([]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(retainedShape).register({ host: () => 1 }).build();
const retainedMissing = DiBag.createModuleBuilder().register({ hidden: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).buildModule([]);
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(retainedMissing).register({ db: () => 1 }).build();

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(DiBag.createModuleBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).buildModule(['root'])).build();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(DiBag.createModuleBuilder().register({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).buildModule([])).build();
