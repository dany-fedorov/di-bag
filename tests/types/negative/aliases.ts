import { DiBag, type Builder, type Provider, type Registration } from '../../../src';
import type { Token } from '../../../src/tokens';
const key = Symbol('source'); const target = DiBag.token(key).of<number>();
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
const wrong = DiBag.token(key).of<string>();
const base = DiBag.createBuilder().withServices({ value: () => 1 });
// diagnostic: new names or typed tokens only
base.withServiceAlias({ aliasKey: 'value', targetServiceKey: 'value' });
// diagnostic: existing
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'missing' });
// diagnostic: service
base.withServiceAlias({ aliasKey: wrong, targetServiceKey: 'value' });
// diagnostic: incompatible
DiBag.createBuilder().withTokenService(wrong, () => 'bad').withServiceAlias({ aliasKey: 'copy', targetServiceKey: target });
// diagnostic: incompatible
DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).withTokenService(wrong, () => 'bad');
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).buildContainer();
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([DiBag.createBuilder().withServiceAlias({ aliasKey: 'copy', targetServiceKey: target }).buildModule({ exportedServiceKeys: [] })]).buildContainer();
// diagnostic: consumer dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withReplacedService<'value', () => string>('value', () => 'bad');
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ value: () => 1 }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withReplacedService<'value', () => string>('value', () => 'bad');
const exported = DiBag.createBuilder().withServices({ value: () => 1 }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['value'] }).withRenamedExport({ currentExportKey: 'value', newExportKey: 'renamed' });
// diagnostic: consumer dependency
DiBag.createBuilder().withInstalledModules([exported]).withReplacedService<'renamed', () => string>('renamed', () => 'bad');
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
const root = DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ root }).buildContainer();
const transient = DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient');
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ transient, root: DiBag.withLifetime(({ transient }: { transient: number }) => transient, 'root') }).buildContainer();
const privateScoped = DiBag.createBuilder().withServices({ value: () => 1 }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy'] }).withRenamedExport({ currentExportKey: 'copy', newExportKey: 'renamed' });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withInstalledModules([privateScoped]).withServices({ root: DiBag.withLifetime(({ renamed }: { renamed: number }) => renamed, 'root') }).buildContainer();
const privateRootBuilder = DiBag.createBuilder().withServices({ value: () => 1 }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).withServices({ root });
// diagnostic: root lifetime cannot capture scoped dependency: root -> value
privateRootBuilder.buildModule({ exportedServiceKeys: [] });
const transientBag = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => 1, 'transient') }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
// diagnostic: cannot share transient
transientBag.createChildContainer({ sharedParentServiceKeys: ['copy'] });
const privateTransient = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => 1, 'transient') }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildModule({ exportedServiceKeys: ['copy'] });
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
declare const erased: Registration;
// diagnostic: finite string-keyed
original.withReplacedService<'value', typeof erased>('value', erased);
const sharingBase = DiBag.createBuilder().withServices({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
const parentScoped = sharingBase.createChildContainer(['value'], { value: DiBag.withLifetime(() => 2, 'root') }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentScoped.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { sharedParentServiceKeys: ['copy'] });
const rootedTarget = DiBag.createBuilder().withServices({ value: DiBag.withLifetime(() => 1, 'root'), consumer: ({ copy }: { copy: number }) => copy }).withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
const parentRoot = rootedTarget.createChildContainer(['value'], { value: () => 2 }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.createChildContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.createIndependentContainer(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
sharingBase.createChildContainer(['value', 'consumer'], { value: DiBag.withLifetime(() => 2, 'root'), consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { sharedParentServiceKeys: ['copy'] });
const sharedRootConsumer = rootedTarget.createChildContainer(['value', 'consumer'], { value: () => 2, consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharedRootConsumer.createIndependentContainer();
const transientOverride = rootedTarget.createChildContainer(['value'], { value: DiBag.withLifetime(() => 3, 'transient') }, { sharedParentServiceKeys: ['copy'] });
// diagnostic: cannot share transient
transientOverride.createChildContainer().createChildContainer({ sharedParentServiceKeys: ['copy'] });
// diagnostic: cannot share transient
transientOverride.createIndependentContainer().createChildContainer({ sharedParentServiceKeys: ['copy'] });
const aliasKey = Symbol('alias'); const aliasToken = DiBag.token(aliasKey).of<number>();
const rootOptional = DiBag.withLifetime(DiBag.fromFunction([DiBag.optional(aliasToken)], value => value), 'root');
const rootLazy = DiBag.withLifetime(DiBag.fromFunction([DiBag.lazy(aliasToken)], get => get()), 'root');
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: aliasToken, targetServiceKey: 'value' }).withServices({ rootOptional }).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
base.withServiceAlias({ aliasKey: aliasToken, targetServiceKey: 'value' }).withServices({ rootLazy }).buildContainer();
const externalPrivate = DiBag.createBuilder().withServiceAlias({ aliasKey: aliasToken, targetServiceKey: target }).withServices({ rootLazy }).buildModule({ exportedServiceKeys: [] });
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().withTokenService(target, () => 1).withInstalledModules([externalPrivate]).buildContainer();
const moduleHistory = DiBag.createBuilder().withServices({ value: () => 1 });
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
