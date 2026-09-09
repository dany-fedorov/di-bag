import { DiBag } from '../../../src';
const { withLifetime } = DiBag;
import type { Provider } from '../../../src';
import type { ProviderBase } from '../../../src/provider';
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root') }).end();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

const key: unique symbol = Symbol('db');
const dbToken = DiBag.token(key).of<number>();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(dbToken, () => 1).add({ root: withLifetime(DiBag.fromTokens([dbToken], db => db), 'root') }).end();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(dbToken, () => 1).add({ bridge: withLifetime(DiBag.fromTokens([dbToken], db => db), 'transient'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

const privateCollision = DiBag.module().add({ db: () => 1, bridge: withLifetime(({ db }: { db: number }) => db, 'transient') }).exports(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateCollision).add({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

const renamed = DiBag.module().add({ bridge: withLifetime(({ external }: { external: number }) => external, 'transient') }).exports(['bridge']).rename('bridge', 'external');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(renamed).replace('external', () => 1).add({ root: withLifetime(({ external }: { external: number }) => external, 'root') }).end();

const privateRoot = DiBag.module().add({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root'), api: () => 1 }).exports(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateRoot).replace('api', withLifetime(() => 1, 'root')).end();

const exportless = DiBag.module().add({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(exportless).end();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, permissive: withLifetime(({ db }: { db: number }) => db, 'root', { captureScoped: true }), a: withLifetime(({ permissive }: { permissive: number }) => permissive, 'root'), c: withLifetime(({ db }: { db: number }) => db, 'root') }).end();

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, a: withLifetime(({ b, db }: { b: number; db: number }): number => b + db, 'transient'), b: withLifetime(({ a }: { a: number }): number => a, 'transient'), root: withLifetime(({ a }: { a: number }) => a, 'root') }).end();

const valid = DiBag.begin().add({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ db }: { db: number }) => db, 'root') }).end();
// diagnostic: root lifetime cannot capture scoped dependency
valid.fork(['db'], { db: () => 1 });

declare const bool: boolean;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', { captureScoped: bool }) }).end();

// diagnostic: lifetime capture options require root
withLifetime(() => 1, 'transient', { captureScoped: false });
// diagnostic: lifetime capture options require root
withLifetime(() => 1, 'scoped', { captureScoped: undefined });
declare const policy: 'root' | 'transient';
// diagnostic: lifetime requires an individually known policy literal
withLifetime(() => 1, policy);

const union = Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: union }).end();
const unionModule = DiBag.module().add({ db: () => 1, bridge: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'transient') : withLifetime(({ db }: { db: number }) => db, 'root') }).exports(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(unionModule).add({ db: withLifetime(() => 1, 'root'), root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

declare const opaque: ProviderBase;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.begin().add({ opaque: withLifetime(opaque, 'root') });
declare const erased: Provider<() => number>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: erased, root: withLifetime(({ db }: { db: number }) => db, 'root') }).end();
// diagnostic: not assignable
const erasedRoot: Provider<() => number> = withLifetime(() => 1, 'root');
void erasedRoot;

const exportedTransient = DiBag.module().add({ db: () => 1, bridge: withLifetime(({ db, external }: { db: number; external: number }) => db + external, 'transient') }).exports(['db', 'bridge']).rename('db', 'external');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(exportedTransient).add({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

const privateToken = DiBag.module().bind(dbToken, () => 1).add({ bridge: withLifetime(DiBag.fromTokens([dbToken], db => db), 'transient') }).exports(['bridge']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateToken).bind(dbToken, withLifetime(() => 1, 'root')).add({ root: withLifetime(({ bridge }: { bridge: number }) => bridge, 'root') }).end();

const tokenRoot = DiBag.begin().bind(dbToken, withLifetime(() => 1, 'root')).add({ root: withLifetime(DiBag.fromTokens([dbToken], value => value), 'root') }).end();
// diagnostic: root lifetime cannot capture scoped dependency
tokenRoot.fork([dbToken], { [key]: () => 1 });

const mixedExport = DiBag.module().add({ db: () => 1, api: Math.random() ? withLifetime(({ db }: { db: number }) => db, 'root') : ({ db }: { db: number }) => db }).exports(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(mixedExport).end();
declare const noInferUnion: NoInfer<typeof union>;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: noInferUnion }).end();

declare const mixedOpaque: NoInfer<ProviderBase | typeof union>;
// diagnostic: factory dependencies must be finite string-keyed objects
DiBag.begin().add({ db: () => 1, root: withLifetime(mixedOpaque, 'root') });

const renamePrivateRoot = DiBag.module().add({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).exports(['db']).rename('db', 'database');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(renamePrivateRoot).end();

const wrappedUnion = DiBag.withMetadata(union, {});
const wrappedUnionModule = DiBag.module().add({ db: () => 1, api: wrappedUnion }).exports(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(wrappedUnionModule).end();

const sameName = DiBag.module().add({ local: withLifetime(({ db }: { db: number }) => db, 'transient'), api: withLifetime(({ local }: { local: number }) => local, 'transient'), db: () => 1 }).exports(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(sameName).add({ local: withLifetime(({ api }: { api: number }) => api, 'root') }).end();

const firstContext = DiBag.module().add({ hop: withLifetime(({ second }: { second: number }) => second, 'transient'), first: withLifetime(({ hop }: { hop: number }) => hop, 'transient') }).exports(['first']);
const secondContext = DiBag.module().add({ hop: withLifetime(({ db }: { db: number }) => db, 'transient'), second: withLifetime(({ hop }: { hop: number }) => hop, 'transient'), db: () => 1 }).exports(['second']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(firstContext).install(secondContext).add({ root: withLifetime(({ first }: { first: number }) => first, 'root') }).end();

// diagnostic: missing factories
DiBag.begin().add({ db: () => 1, root: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).end();
// diagnostic: a dependency has the wrong shape
DiBag.begin().add({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).end();
// diagnostic: not assignable
withLifetime(() => 1, 'unknown');
declare const unknownPolicy: string;
// diagnostic: not assignable
withLifetime(() => 1, unknownPolicy);
// diagnostic: lifetime capture options require root
withLifetime(() => 1, 'root', { captureScoped: undefined });

// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: DiBag.mapAsync(withLifetime(({ db }: { db: number }) => db, 'root'), value => value) }).end();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: DiBag.withDisposal(withLifetime(({ db }: { db: number }) => db, 'root'), () => {}) }).end();

declare const unionCapture: Readonly<{}> | { captureScoped: false };
// diagnostic: lifetime capture options require root
withLifetime(() => 1, 'transient', unionCapture);
declare const unionUnknown: Readonly<{}> | { unsupported: true };
// diagnostic: lifetime capture options require root
withLifetime(() => 1, 'root', unionUnknown);

declare const optionalCapture: { captureScoped: true } | undefined;
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalCapture) }).end();
declare const optionalField: { captureScoped?: true };
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().add({ db: () => 1, root: withLifetime(({ db }: { db: number }) => db, 'root', optionalField) }).end();
// diagnostic: Expected 3 arguments
withLifetime<() => number, 'root', { captureScoped: true }>(() => 1, 'root');
// diagnostic: captureScoped
withLifetime<() => number, 'root', { captureScoped: true }>(() => 1, 'root', {});

const retainedShape = DiBag.module().add({ hidden: withLifetime(({ host }: { host: string }) => host, 'root') }).exports([]);
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(retainedShape).add({ host: () => 1 }).end();
const retainedMissing = DiBag.module().add({ hidden: withLifetime(({ missing, db }: { missing: number; db: number }) => missing + db, 'root') }).exports([]);
// diagnostic: missing factories
DiBag.begin().install(retainedMissing).add({ db: () => 1 }).end();

// diagnostic: a dependency has the wrong shape
DiBag.begin().install(DiBag.module().add({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).exports(['root'])).end();
// diagnostic: a dependency has the wrong shape
DiBag.begin().install(DiBag.module().add({ db: () => 1, root: withLifetime(({ db }: { db: string }) => db, 'root') }).exports([])).end();
