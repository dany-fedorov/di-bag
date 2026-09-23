import { DiBag, type Provider, type TokenDependencyContract } from '../../../src';
import type { OpaqueGraph } from '../../../src/token-types';
import type { TokenBase } from '../../../src/tokens';

// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ read: ({ value }: { value: number }) => value }).withServices({ value: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 'wrong' }).withServices({ read: ({ value }: { value: number }) => value });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 1, read: ({ value }: { value: string }) => value });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 1, read: ({ value }: { value: number }) => value }).withReplacedService('value', () => 'wrong');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 1, read: ({ value }: { value: number }) => value }).withReplacedService('read', ({ value }: { value: string }) => value);

const key = Symbol('value');
const token = DiBag.createToken(key).forService<number>();
const wider = DiBag.createToken(key).forService<number | string>();
// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ read: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) }).withTokenService(token, () => 1);
// diagnostic: incompatible or opaque
DiBag.createBuilder().withTokenService(token, () => 1).withServices({ read: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) });
// diagnostic: incompatible or opaque
DiBag.createBuilder().withTokenService(token, () => 1).withServices({ read: () => 1 }).withReplacedService('read', DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }));
// diagnostic: output is not assignable
DiBag.createBuilder().withTokenService(token, () => 1).withReplacedService(token, () => 'wrong');
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withServices({ value: () => 1 }).withTokenService(token, ({ value }: { value: string }) => value.length);
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({ read: DiBag.createProviderFromFunction({ dependencies: [token], factoryFunction: value => value }) }).buildContainer();

declare const opaque: Provider<() => number, {}, readonly [], OpaqueGraph>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ opaque });
declare const opaqueBound: Provider<() => number, {}, readonly [], TokenDependencyContract<readonly [], TokenBase>>;
// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ opaqueBound });

const privateModule = DiBag.createBuilder().withServices({ hidden: ({ external }: { external: number }) => external }).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([privateModule]).withServices({ external: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([privateModule]).withServices({ external: () => 1 }).withReplacedService('external', () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([privateModule]).buildContainer();

const privateToken = DiBag.createBuilder().withServices({ hidden: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([privateToken]).withTokenService(token, () => 1);

// diagnostic: incompatible or opaque
DiBag.createBuilder().withServices({ read: ({ value }: { value: number }) => value }).withServices({ opaque, value: () => 'wrong' });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withTokenService(token, () => 1).withServices({ local: () => 1,
  invalidNamed: ({ local }: { local: string }) => local.length,
  wrongToken: DiBag.createProviderFromFunction({ dependencies: [wider], factoryFunction: value => value }) });

// Manually described histories remain checked even when an incoming name cannot
// match any typed-token key.
declare const manuallyOpaque: import('../../../src').Builder<{ key: 'opaque'; registration: typeof opaque }>;
// diagnostic: incompatible or opaque
manuallyOpaque.withServices({ unrelated: () => 1 });
// diagnostic: required service registrations are missing
manuallyOpaque.buildContainer();
declare const manuallyMixed: import('../../../src').Builder<
  { key: 'opaque'; registration: typeof opaque } | { key: 'plain'; registration: () => number }
>;
// diagnostic: incompatible or opaque
manuallyMixed.withServices({ unrelated: () => 1 });
