import { DiBag } from '../../../src';
const withLifetime = DiBag.withLifetime;

const inner = DiBag.createBuilder().withServices({
  service: ({ logger, clock }: { logger: { log(message: string): void }; clock: { now(): number } }) => [logger, clock],
}).buildModule({ exportedServiceKeys: ['service'] });
const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({ logger: () => ({ log(_message: string) {} }) }).buildModule({ exportedServiceKeys: ['service'] });

// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([outer]).withServices({ clock: () => 'wrong' });

// A need satisfied through an outer export is still checked when the host replaces that export.
const exported = DiBag.createBuilder().withInstalledModules([inner]).withServices({ logger: () => ({ log(_message: string) {} }) }).buildModule({ exportedServiceKeys: ['service', 'logger'] }).withRenamedExport({ currentExportKey: 'logger', newExportKey: 'sink' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([exported]).withServices({ clock: () => ({ now: () => 1 }) }).withReplacedService('sink', () => 'wrong');

// Private nested names are not resolvable from the host.
const host = DiBag.createBuilder().withInstalledModules([outer]).withServices({ clock: () => ({ now: () => 1 }) }).buildContainer();
// diagnostic: Argument of type '"logger"'
host.resolve('logger');

// Token requirements forward outward through every level.
const clockKey = Symbol('clock');
const clockToken = DiBag.createToken(clockKey).forService<{ now(): number }>();
const narrowToken = DiBag.createToken(clockKey).forService<{ now(): number; extra: true }>();
const tokenInner = DiBag.createBuilder().withServices({ stamp: DiBag.createProviderFromFunction({ dependencies: [narrowToken], factoryFunction: clock => clock.now() }) }).buildModule({ exportedServiceKeys: ['stamp'] });
const tokenOuter = DiBag.createBuilder().withInstalledModules([tokenInner]).buildModule({ exportedServiceKeys: ['stamp'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([tokenOuter]).withTokenService(clockToken, () => ({ now: () => 1 }));

// A root inside an inner module that captures a scoped private dependency of the outer module.
const capturing = DiBag.createBuilder().withServices({ root: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule({ exportedServiceKeys: ['root'] });
const scopedOuter = DiBag.createBuilder().withInstalledModules([capturing]).withServices({ db: () => 1 }).buildModule({ exportedServiceKeys: ['root'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([scopedOuter]).buildContainer();

// The same capture through an exported and renamed dependency.
const exportedOuter = DiBag.createBuilder().withInstalledModules([capturing]).withServices({ db: () => 1 }).buildModule({ exportedServiceKeys: ['root', 'db'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'database' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([exportedOuter]).buildContainer();

// A private root of the outer module that captures through an inner transient bridge.
const bridge = DiBag.createBuilder().withServices({ hop: withLifetime(({ db }: { db: number }) => db, 'transient') }).buildModule({ exportedServiceKeys: ['hop'] });
const privateRootBuilder = DiBag.createBuilder().withInstalledModules([bridge]).withServices({ db: () => 1, hidden: withLifetime(({ hop }: { hop: number }) => hop, 'root'), api: () => 1 });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
privateRootBuilder.buildModule({ exportedServiceKeys: ['api'] });

// A host root capturing through two nested transient bridges, where the scoped source is host-provided.
const deepBridge = DiBag.createBuilder().withInstalledModules([bridge]).withServices({ relay: withLifetime(({ hop }: { hop: number }) => hop, 'transient') }).buildModule({ exportedServiceKeys: ['relay'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([deepBridge]).withServices({ db: () => 1, root: withLifetime(({ relay }: { relay: number }) => relay, 'root') }).buildContainer();

// A root contribution whose private dependency is scoped is rejected when its module seals.
const groupKey = Symbol('group');
const group = DiBag.createToken(groupKey).forCollectionOf<number>();
const contributingBuilder = DiBag.createBuilder().withServices({ hidden: () => 1 }).withCollectionContribution({ collectionToken: group, provider: withLifetime(({ hidden }: { hidden: number }) => hidden, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: contribution -> hidden
contributingBuilder.buildModule({ exportedServiceKeys: [] });
