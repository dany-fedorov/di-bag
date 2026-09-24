import { DiBag, type Builder, type Provider, type ProviderOrFactory } from '../../../src';
import type { Token } from '../../../src/tokens';
const key = Symbol('source'); const target = DiBag.createToken(key).forService<number>();
const otherKey = Symbol('other'); const other = DiBag.createToken(otherKey).forService<number>();
const wrong = DiBag.createToken(key).forService<string>();
const base = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
// diagnostic: new names or typed tokens only
base.withServiceAlias({ aliasKey: 'value', targetServiceKey: 'value' });
// diagnostic: existing
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'missing' });
// diagnostic: service
base.withServiceAlias({ aliasKey: wrong, targetServiceKey: 'value' });
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(wrong, DiBag.providerWithLifetime({ provider: () => 'bad', lifetime: 'scoped:one-per-container' })).withServiceAlias({ aliasKey: 'copy', targetServiceKey: target });
// diagnostic: incompatible
DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).withTokenService(wrong, DiBag.providerWithLifetime({ provider: () => 'bad', lifetime: 'scoped:one-per-container' }));
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
// diagnostic: consumer dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withReplacedService<'value', () => string>('value', DiBag.providerWithLifetime({ provider: () => 'bad', lifetime: 'scoped:one-per-container' }));
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withReplacedService<'value', () => string>('value', DiBag.providerWithLifetime({ provider: () => 'bad', lifetime: 'scoped:one-per-container' }));
const exported = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'renamed' });
// diagnostic: consumer dependency
DiBag.createBuilder().withInstalledModules([exported]).withReplacedService<'renamed', () => string>('renamed', DiBag.providerWithLifetime({ provider: () => 'bad', lifetime: 'scoped:one-per-container' }));
declare const name: string; declare const names: 'value' | 'copy'; declare const tokens: typeof target | typeof other; declare const erasedToken: Token<symbol, number>;
// diagnostic: singleton
base.withServiceAlias({ aliasKey: name, targetServiceKey: 'value' });
// diagnostic: singleton
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: name });
// diagnostic: singleton
base.withServiceAlias({ aliasKey: names, targetServiceKey: 'value' });
// diagnostic: singleton
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: tokens });
// diagnostic: singleton
base.withServiceAlias({ aliasKey: erasedToken, targetServiceKey: 'value' });
// diagnostic: not assignable
base.withServiceAlias({ aliasKey: Symbol('fake'), targetServiceKey: 'value' });
// diagnostic: not assignable
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: DiBag.optional(target) });
// diagnostic: singleton
base.withServiceAlias<'one' | 'two', 'value'>({ aliasKey: 'one', targetServiceKey: 'value' });
// diagnostic: Expected 2 arguments
base.withServiceAlias<never, 'value'>({ aliasKey: 'one' as never, targetServiceKey: 'value' });
const root = DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' });
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ root }).buildContainer();
const transient = DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'transient:one-per-resolve' });
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ transient, root: DiBag.providerWithLifetime({ provider: ({ transient }: { transient: number }) => transient, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const privateScoped = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy'] }).withRenamedExport({ currentExportKey: 'copy', newExportKey: 'renamed' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateScoped]).withServices({ root: DiBag.providerWithLifetime({ provider: ({ renamed }: { renamed: number }) => renamed, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const privateRootBuilder = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ root });
// diagnostic: root lifetime cannot capture scoped dependency: root -> value
privateRootBuilder.buildModule({ exportedServiceKeys: [] });
const transientBag = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
// diagnostic: cannot share transient
transientBag.createChildContainer({ sharedParentServiceKeys: ['copy'] });
const privateTransient = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy'] });
// diagnostic: cannot share transient
DiBag.createBuilder().withInstalledModules([privateTransient]).buildContainer().createChildContainer({ sharedParentServiceKeys: ['copy'] });
const original = base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' });
// diagnostic: not assignable
const erasedHistory: typeof base = original;
// diagnostic: not assignable
const erasedEmpty: Builder<never> = original;
declare const provider: Provider<() => number>;
declare const union: typeof provider | (() => string);
// diagnostic: consumer dependency
original.withReplacedService<'value', typeof union>('value', union);
declare const erased: ProviderOrFactory;
// diagnostic: finite string-keyed
original.withReplacedService<'value', typeof erased>('value', erased);
const sharingBase = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }), consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
const parentScoped = sharingBase.createChildContainer(['value'], { value: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentScoped.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
const rootedTarget = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }), consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'scoped:one-per-container' }) }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
const parentRoot = rootedTarget.createIndependentContainer(['value'], { value: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.createIndependentContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
// diagnostic: root lifetime cannot capture scoped dependency
sharingBase.createChildContainer(['value', 'consumer'], { value: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'singleton:one-per-container-tree' }), consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
const sharedRootConsumer = rootedTarget.createChildContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharingBase.createIndependentContainer(['consumer'], { consumer: DiBag.providerWithLifetime({ provider: ({ copy }: { copy: number }) => copy, lifetime: 'singleton:one-per-container-tree' }) });
const transientOverride = sharingBase.createChildContainer(['value'], { value: DiBag.providerWithLifetime({ provider: () => 3, lifetime: 'transient:one-per-resolve' }) }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: cannot share transient
transientOverride.createChildContainer().createChildContainer({ sharedParentServiceKeys: ['copy'] });
// diagnostic: cannot share transient
transientOverride.createIndependentContainer().createChildContainer({ sharedParentServiceKeys: ['copy'] });
const aliasKey = Symbol('alias'); const aliasToken = DiBag.createToken(aliasKey).forService<number>();
const rootOptional = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(aliasToken)], factoryFunction: value => value }), lifetime: 'singleton:one-per-container-tree' });
const rootLazy = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(aliasToken)], factoryFunction: get => get() }), lifetime: 'singleton:one-per-container-tree' });
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: aliasToken, targetServiceKey: 'value' }).withServices({ rootOptional }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: aliasToken, targetServiceKey: 'value' }).withServices({ rootLazy }).buildContainer();
const externalPrivate = DiBag.createBuilder().withServiceAlias({ aliasKey: aliasToken, targetServiceKey: target }).withServices({ rootLazy }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(target, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withInstalledModules([externalPrivate]).buildContainer();
const moduleHistory = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
const moduleAlias = moduleHistory.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' });
// diagnostic: not assignable
const erasedModuleHistory: typeof moduleHistory = moduleAlias;
// diagnostic: not assignable
const forgedDestination: Parameters<typeof base.withServiceAlias>[0]['aliasKey'] = 'copy';
// diagnostic: not assignable
const forgedTarget: Parameters<typeof base.withServiceAlias>[0]['targetServiceKey'] = 'value';
// diagnostic: Expected 2 arguments
base.withServiceAlias<'copy', never>({ aliasKey: 'copy', targetServiceKey: 'value' as never });
declare const reflectedBuilder: ReturnType<typeof base.withServiceAlias>;
// diagnostic: not assignable
reflectedBuilder.buildContainer().resolve('copy');
