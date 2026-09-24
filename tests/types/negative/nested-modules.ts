import { DiBag } from '../../../src';
const inner = DiBag.createBuilder().withServices({
  service: DiBag.providerWithLifetime({ provider: ({ logger, clock }: { logger: { log(message: string): void }; clock: { now(): number } }) => [logger, clock], lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['service'] });
const outer = DiBag.createBuilder().withInstalledModules([inner]).withServices({ logger: DiBag.providerWithLifetime({ provider: () => ({ log(_message: string) {} }), lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['service'] });

// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([outer]).buildContainer();
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([outer]).withServices({ clock: DiBag.providerWithLifetime({ provider: () => 'wrong', lifetime: 'scoped:one-per-container' }) });

// A need satisfied through an outer export is still checked when the host replaces that export.
const exported = DiBag.createBuilder().withInstalledModules([inner]).withServices({ logger: DiBag.providerWithLifetime({ provider: () => ({ log(_message: string) {} }), lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['service', 'logger'] }).withRenamedExport({ currentExportKey: 'logger', newExportKey: 'sink' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([exported]).withServices({ clock: DiBag.providerWithLifetime({ provider: () => ({ now: () => 1 }), lifetime: 'scoped:one-per-container' }) }).withReplacedService('sink', DiBag.providerWithLifetime({ provider: () => 'wrong', lifetime: 'scoped:one-per-container' }));

// Private nested names are not resolvable from the host.
const host = DiBag.createBuilder().withInstalledModules([outer]).withServices({ clock: DiBag.providerWithLifetime({ provider: () => ({ now: () => 1 }), lifetime: 'scoped:one-per-container' }) }).buildContainer();
// diagnostic: Argument of type '"logger"'
host.resolve('logger');

// Token requirements forward outward through every level.
const clockKey = Symbol('clock');
const clockToken = DiBag.createToken(clockKey).forService<{ now(): number }>();
const narrowToken = DiBag.createToken(clockKey).forService<{ now(): number; extra: true }>();
const tokenInner = DiBag.createBuilder().withServices({ stamp: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [narrowToken], factoryFunction: clock => clock.now() }), lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['stamp'] });
const tokenOuter = DiBag.createBuilder().withInstalledModules([tokenInner]).buildModule({ exportedServiceKeys: ['stamp'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([tokenOuter]).withTokenService(clockToken, DiBag.providerWithLifetime({ provider: () => ({ now: () => 1 }), lifetime: 'scoped:one-per-container' }));

// A root inside an inner module that captures a scoped private dependency of the outer module.
const capturing = DiBag.createBuilder().withServices({ root: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'singleton:one-per-container-tree' }) }).buildModule({ exportedServiceKeys: ['root'] });
const scopedOuter = DiBag.createBuilder().withInstalledModules([capturing]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['root'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([scopedOuter]).buildContainer();

// The same capture through an exported and renamed dependency.
const exportedOuter = DiBag.createBuilder().withInstalledModules([capturing]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['root', 'db'] }).withRenamedExport({ currentExportKey: 'db', newExportKey: 'database' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([exportedOuter]).buildContainer();

// A private root of the outer module that captures through an inner transient bridge.
const bridge = DiBag.createBuilder().withServices({ hop: DiBag.providerWithLifetime({ provider: ({ db }: { db: number }) => db, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['hop'] });
const privateRootBuilder = DiBag.createBuilder().withInstalledModules([bridge]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), hidden: DiBag.providerWithLifetime({ provider: ({ hop }: { hop: number }) => hop, lifetime: 'singleton:one-per-container-tree' }), api: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
privateRootBuilder.buildModule({ exportedServiceKeys: ['api'] });

// A host root capturing through two nested transient bridges, where the scoped source is host-provided.
const deepBridge = DiBag.createBuilder().withInstalledModules([bridge]).withServices({ relay: DiBag.providerWithLifetime({ provider: ({ hop }: { hop: number }) => hop, lifetime: 'transient:one-per-resolve' }) }).buildModule({ exportedServiceKeys: ['relay'] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([deepBridge]).withServices({ db: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), root: DiBag.providerWithLifetime({ provider: ({ relay }: { relay: number }) => relay, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();

// A root contribution whose private dependency is scoped is rejected when its module seals.
const groupKey = Symbol('group');
const group = DiBag.createToken(groupKey).forCollectionOf<number>();
const contributingBuilder = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withCollectionContribution({ collectionToken: group, provider: DiBag.providerWithLifetime({ provider: ({ hidden }: { hidden: number }) => hidden, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency: contribution -> hidden
contributingBuilder.buildModule({ exportedServiceKeys: [] });
