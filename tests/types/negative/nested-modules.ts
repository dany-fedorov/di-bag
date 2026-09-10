import { DiBag } from '../../../src';
const withLifetime = DiBag.withLifetime;

const inner = DiBag.createBuilder().register({
  service: ({ logger, clock }: { logger: { log(message: string): void }; clock: { now(): number } }) => [logger, clock],
}).buildModule(['service']);
const outer = DiBag.createBuilder().installModule(inner).register({ logger: () => ({ log(_message: string) {} }) }).buildModule(['service']);

// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(outer).build();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(outer).register({ clock: () => 'wrong' });

// A need satisfied through an outer export is still checked when the host replaces that export.
const exported = DiBag.createBuilder().installModule(inner).register({ logger: () => ({ log(_message: string) {} }) }).buildModule(['service', 'logger']).renameExport('logger', 'sink');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(exported).register({ clock: () => ({ now: () => 1 }) }).replace('sink', () => 'wrong');

// Private nested names are not resolvable from the host.
const host = DiBag.createBuilder().installModule(outer).register({ clock: () => ({ now: () => 1 }) }).build();
// diagnostic: Argument of type '"logger"'
host.resolve('logger');

// Token requirements forward outward through every level.
const clockKey = Symbol('clock');
const clockToken = DiBag.token(clockKey).of<{ now(): number }>();
const narrowToken = DiBag.token(clockKey).of<{ now(): number; extra: true }>();
const tokenInner = DiBag.createBuilder().register({ stamp: DiBag.fromFunction([narrowToken], clock => clock.now()) }).buildModule(['stamp']);
const tokenOuter = DiBag.createBuilder().installModule(tokenInner).buildModule(['stamp']);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().installModule(tokenOuter).register(clockToken, () => ({ now: () => 1 }));

// A root inside an inner module that captures a scoped private dependency of the outer module.
const capturing = DiBag.createBuilder().register({ root: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule(['root']);
const scopedOuter = DiBag.createBuilder().installModule(capturing).register({ db: () => 1 }).buildModule(['root']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(scopedOuter).build();

// The same capture through an exported and renamed dependency.
const exportedOuter = DiBag.createBuilder().installModule(capturing).register({ db: () => 1 }).buildModule(['root', 'db']).renameExport('db', 'database');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(exportedOuter).build();

// A private root of the outer module that captures through an inner transient bridge.
const bridge = DiBag.createBuilder().register({ hop: withLifetime(({ db }: { db: number }) => db, 'transient') }).buildModule(['hop']);
const privateRoot = DiBag.createBuilder().installModule(bridge).register({ db: () => 1, hidden: withLifetime(({ hop }: { hop: number }) => hop, 'root'), api: () => 1 }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).build();

// A host root capturing through two nested transient bridges, where the scoped source is host-provided.
const deepBridge = DiBag.createBuilder().installModule(bridge).register({ relay: withLifetime(({ hop }: { hop: number }) => hop, 'transient') }).buildModule(['relay']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(deepBridge).register({ db: () => 1, root: withLifetime(({ relay }: { relay: number }) => relay, 'root') }).build();

// A nested contribution whose private dependency is scoped, consumed by a host root collection.
const groupKey = Symbol('group');
const group = DiBag.token(groupKey).of<number>();
const contributing = DiBag.createBuilder().register({ hidden: () => 1 }).contribute(group, withLifetime(({ hidden }: { hidden: number }) => hidden, 'root')).buildModule([]);
const wrapped = DiBag.createBuilder().installModule(contributing).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(wrapped).build();
