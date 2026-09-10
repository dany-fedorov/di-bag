import { DiBag, type Builder, type Provider, type Registration } from '../../../src';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('source'); const target = DiBag.token(key).of<number>();
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
const wrong = DiBag.token(key).of<string>();
const base = DiBag.createBuilder().register({ value: () => 1 });
// diagnostic: new names or typed tokens only
base.alias('value', 'value');
// diagnostic: existing
base.alias('copy', 'missing');
// diagnostic: service
base.alias(wrong, 'value');
// diagnostic: incompatible
DiBag.createBuilder().register(wrong, () => 'bad').alias('copy', target);
// diagnostic: incompatible
DiBag.createBuilder().alias('copy', target).register(wrong, () => 'bad');
// diagnostic: required service registrations are missing
DiBag.createBuilder().alias('copy', target).build();
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(DiBag.createBuilder().alias('copy', target).buildModule([])).build();
// diagnostic: consumer dependency
base.alias('copy', 'value').replace<'value', () => string>('value', () => 'bad');
// diagnostic: consumer dependency
DiBag.createBuilder().register({ value: () => 1 }).alias('copy', 'value').replace<'value', () => string>('value', () => 'bad');
const exported = DiBag.createBuilder().register({ value: () => 1 }).alias('copy', 'value').buildModule(['value']).renameExport('value', 'renamed');
// diagnostic: consumer dependency
DiBag.createBuilder().installModule(exported).replace<'renamed', () => string>('renamed', () => 'bad');
declare const name: string; declare const names: 'value' | 'copy'; declare const tokens: typeof target | typeof other; declare const erasedToken: TokenBase;
// diagnostic: singleton
base.alias(name, 'value');
// diagnostic: singleton
base.alias('copy', name);
// diagnostic: singleton
base.alias(names, 'value');
// diagnostic: singleton
base.alias('copy', tokens);
// diagnostic: singleton
base.alias(erasedToken, 'value');
// diagnostic: not assignable
base.alias(Symbol('fake'), 'value');
// diagnostic: not assignable
base.alias('copy', DiBag.optional(target));
// diagnostic: singleton
base.alias<'one' | 'two', 'value'>('one', 'value');
// diagnostic: Expected 3 arguments
base.alias<never, 'value'>('one' as never, 'value');
const root = DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root');
// diagnostic: root lifetime cannot capture scoped dependency
base.alias('copy', 'value').register({ root }).build();
const transient = DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient');
// diagnostic: root lifetime cannot capture scoped dependency
base.alias('copy', 'value').register({ transient, root: DiBag.withLifetime(({ transient }: { transient: number }) => transient, 'root') }).build();
const privateScoped = DiBag.createBuilder().register({ value: () => 1 }).alias('copy', 'value').buildModule(['copy']).renameExport('copy', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateScoped).register({ root: DiBag.withLifetime(({ renamed }: { renamed: number }) => renamed, 'root') }).build();
const privateRoot = DiBag.createBuilder().register({ value: () => 1 }).alias('copy', 'value').register({ root }).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).build();
const transientBag = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => 1, 'transient') }).alias('copy', 'value').build();
// diagnostic: cannot share transient
transientBag.createScope({ share: ['copy'] });
const privateTransient = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => 1, 'transient') }).alias('copy', 'value').buildModule(['copy']);
// diagnostic: cannot share transient
DiBag.createBuilder().installModule(privateTransient).build().createScope({ share: ['copy'] });
const original = base.alias('copy', 'value');
// diagnostic: not assignable
const erasedHistory: typeof base = original;
// diagnostic: not assignable
const erasedEmpty: Builder<never> = original;
declare const provider: Provider<() => number>;
declare const union: typeof provider | (() => string);
// diagnostic: consumer dependency
original.replace<'value', typeof union>('value', union);
declare const erased: Registration;
// diagnostic: finite string-keyed
original.replace<'value', typeof erased>('value', erased);
const sharingBase = DiBag.createBuilder().register({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').build();
const parentScoped = sharingBase.createScope(['value'], { value: DiBag.withLifetime(() => 2, 'root') }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentScoped.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
const rootedTarget = DiBag.createBuilder().register({ value: DiBag.withLifetime(() => 1, 'root'), consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').build();
const parentRoot = rootedTarget.createScope(['value'], { value: () => 2 }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.createScope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
sharingBase.createScope(['value', 'consumer'], { value: DiBag.withLifetime(() => 2, 'root'), consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
const sharedRootConsumer = rootedTarget.createScope(['value', 'consumer'], { value: () => 2, consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharedRootConsumer.fork();
const transientOverride = rootedTarget.createScope(['value'], { value: DiBag.withLifetime(() => 3, 'transient') }, { share: ['copy'] });
// diagnostic: cannot share transient
transientOverride.createScope().createScope({ share: ['copy'] });
// diagnostic: cannot share transient
transientOverride.fork().createScope({ share: ['copy'] });
const aliasKey = Symbol('alias'); const aliasToken = DiBag.token(aliasKey).of<number>();
const rootOptional = DiBag.withLifetime(DiBag.fromFunction([DiBag.optional(aliasToken)], value => value), 'root');
const rootLazy = DiBag.withLifetime(DiBag.fromFunction([DiBag.lazy(aliasToken)], get => get()), 'root');
// diagnostic: root lifetime cannot capture scoped dependency
base.alias(aliasToken, 'value').register({ rootOptional }).build();
// diagnostic: root lifetime cannot capture scoped dependency
base.alias(aliasToken, 'value').register({ rootLazy }).build();
const externalPrivate = DiBag.createBuilder().alias(aliasToken, target).register({ rootLazy }).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().register(target, () => 1).installModule(externalPrivate).build();
const moduleHistory = DiBag.createBuilder().register({ value: () => 1 });
const moduleAlias = moduleHistory.alias('copy', 'value');
// diagnostic: not assignable
const erasedModuleHistory: typeof moduleHistory = moduleAlias;
// diagnostic: not assignable
const forgedDestination: Parameters<typeof base.alias>[0] = 'copy';
// diagnostic: not assignable
const forgedTarget: Parameters<typeof base.alias>[1] = 'value';
// diagnostic: Expected 3 arguments
base.alias<'copy', never>('copy', 'value' as never);
declare const reflectedBuilder: ReturnType<typeof base.alias>;
// diagnostic: not assignable
reflectedBuilder.build().resolve('copy');
