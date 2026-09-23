import { DiBag } from '../../src';
import type { Module } from '../../src';
import type { Assert, Equal } from './assert';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clock = DiBag.createToken(clockKey).forService<Clock>();
const toolsKey = Symbol('tools');
const tools = DiBag.createToken(toolsKey).forCollectionOf<string>();

// Every bag method in one chain; both overloads of withReplacedService.
const chained = DiBag.createBuilder()
  .withServices({ config: () => ({ url: 'x' }) })
  .withTokenService(clock, (): Clock => ({ now: () => 1 }))
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withCollectionContribution({ collectionToken: tools, provider: () => 'search' })
  .withReplacedService('config', () => ({ url: 'y' }))
  .withReplacedService(clock, (): Clock => ({ now: () => 2 }))
  .withReplacedService(tools, (): readonly string[] => ['local']);
chained.verifyGraphAtCompileTime() satisfies void;
const app = chained.buildContainer();
export const aliased: Clock = app.resolve('now');
export const config: { url: string } = app.resolve('config');
export const names: readonly string[] = app.resolveCollection(tools);

// A shorthand bag: the property names equal the variable names.
const token = clock;
const provider = (): Clock => ({ now: () => 3 });
export const shorthand: Clock = DiBag.createBuilder().withTokenService(token, provider).buildContainer().resolve(clock);

// A replacement with dependencies takes the general overload.
const derived = DiBag.createBuilder()
  .withServices({ base: () => 1, derived: ({ base }: { base: number }) => base + 1 })
  .withReplacedService('derived', ({ base }: { base: number }) => base * 2);
export const derivedValue: number = derived.buildContainer().resolve('derived');

// A zero-dependency replacement keeps independent output inference even when
// an existing collection contribution consumes the replaced service.
const inferredReplacement = DiBag.createBuilder()
  .withServices({ inferredClock: () => ({ now: () => 1, unused: () => true }) })
  .withCollectionContribution({ collectionToken: tools, provider: ({ inferredClock }: { inferredClock: { now(): number } }) => String(inferredClock.now()) })
  .withReplacedService('inferredClock', () => ({ now() { return 2; }, extra() { return true; } }))
  .buildContainer();
const inferredReplacementModule = DiBag.createBuilder()
  .withServices({ inferredClock: () => ({ now: () => 1, unused: () => true }) })
  .withCollectionContribution({ collectionToken: tools, provider: ({ inferredClock }: { inferredClock: { now(): number } }) => String(inferredClock.now()) })
  .withReplacedService('inferredClock', () => ({ now() { return 2; }, extra() { return true; } }))
  .buildModule({ exportedServiceKeys: ['inferredClock'] });
const inferredReplacementModuleBag = DiBag.createBuilder().withInstalledModules([inferredReplacementModule]).buildContainer();
export type InferredReplacementExact = [
  Assert<Equal<ReturnType<typeof inferredReplacement.resolve<'inferredClock'>>, { now(): number; extra(): boolean }>>,
  Assert<Equal<ReturnType<typeof inferredReplacementModuleBag.resolve<'inferredClock'>>, { now(): number; extra(): boolean }>>,
];
const asyncReplacement = DiBag.createBuilder()
  .withServices({ asyncValue: async () => 1 })
  .withReplacedService('asyncValue', async () => 2)
  .buildContainer();
export const asyncReplacementValue: Promise<number> = asyncReplacement.resolve('asyncValue');
const explicitReplacementProvider = () => 2;
DiBag.createBuilder()
  .withServices({ explicitReplacement: () => 1 })
  .withReplacedService<'explicitReplacement', typeof explicitReplacementProvider>('explicitReplacement', explicitReplacementProvider);

// A disposable factory through the zero-dependency overload, and a token alias of a named service.
const owned = DiBag.createBuilder()
  .withServices({ connection: DiBag.withDisposal(() => ({ open: true }), connection => { connection.open = false; }) })
  .withReplacedService('connection', DiBag.withDisposal(() => ({ open: false }), () => {}))
  .withServices({ time: (): Clock => ({ now: () => 4 }) })
  .withServiceAlias({ aliasKey: clock, targetServiceKey: 'time' });
export const viaToken: Clock = owned.buildContainer().resolve(clock);

// buildModule: an inline tuple, an empty tuple, a token, a label.
const logging = DiBag.createBuilder()
  .withServices({ prefix: () => '[m]', logger: ({ prefix }: { prefix: string }) => ({ log: (line: string) => prefix + line }) })
  .buildModule({ exportedServiceKeys: ['logger'], moduleLabel: 'logging' });
const feature = DiBag.createBuilder()
  .withServices({ service: ({ logger }: { logger: { log(line: string): string } }) => ({ read: () => logger.log('x') }) })
  .buildModule({ exportedServiceKeys: ['service'] });
const tokenFeature = DiBag.createBuilder()
  .withTokenService(clock, (): Clock => ({ now: () => 5 }))
  .buildModule({ exportedServiceKeys: [clock] });
const contributing = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: tools, provider: () => 'fetch' })
  .buildModule({ exportedServiceKeys: [] });
export const exportsNothing: Module<{}, {}, any, any> = contributing;

// A list: a requirement met by a LATER module of the same list, a token module, a contributing module.
const listed = DiBag.createBuilder().withInstalledModules([feature, logging, tokenFeature, contributing]).buildContainer();
export const service: { read(): string } = listed.resolve('service');
export const moduleClock: Clock = listed.resolve(clock);
export const moduleTools: readonly string[] = listed.resolveCollection(tools);
// The same modules one call at a time resolve the same keys.
const separate = DiBag.createBuilder().withInstalledModules([feature]).withInstalledModules([logging]).withInstalledModules([tokenFeature]).buildContainer();
export const sameService: { read(): string } = separate.resolve('service');
// An empty list, a list declared separately, a requirement met by the host, a host service between two lists.
DiBag.createBuilder().withInstalledModules([]).buildContainer();
const declared = [feature, logging] as const;
DiBag.createBuilder().withInstalledModules(declared).buildContainer();
DiBag.createBuilder().withInstalledModules([feature]).withServices({ logger: () => ({ log: (line: string) => line }) }).buildContainer();
DiBag.createBuilder().withInstalledModules([feature]).withServices({ extra: () => 1 }).withInstalledModules([logging]).buildContainer();

export type PhysicalClock = { now(): number };
const physicalClockKey = Symbol('physical-clock');
const physicalToolsKey = Symbol('physical-tools');
export const physicalClock = DiBag.createToken(physicalClockKey).forService<PhysicalClock>();
export const physicalTools = DiBag.createToken(physicalToolsKey).forCollectionOf<string>();
export const withServicesMethod = DiBag.createBuilder().withServices;
export const withTokenServiceMethod = DiBag.createBuilder().withTokenService;
export const withServiceAliasMethod = DiBag.createBuilder().withServices({ target: () => 1 }).withServiceAlias;
export const withCollectionContributionMethod = DiBag.createBuilder().withCollectionContribution;
export const withReplacedServiceMethod = DiBag.createBuilder()
  .withServices({ base: () => 1, derived: ({ base }: { base: number }) => base + 1 }).withReplacedService;
export const buildModuleMethod = DiBag.createBuilder().withServices({ moduleValue: () => true }).buildModule;
export const physicalLogging = logging;
export const physicalFeature = feature;
export const withInstalledModulesMethod = DiBag.createBuilder().withInstalledModules;
