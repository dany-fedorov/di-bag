import { DiBag, type Builder, type Provider, type Registration } from '../../../src';
import type { TokenBase } from '../../../src/tokens';
const key = Symbol('source'); const target = DiBag.token(key).of<number>();
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
const wrong = DiBag.token(key).of<string>();
const base = DiBag.begin().add({ value: () => 1 });
// diagnostic: new tokens only
base.alias('value', 'value');
// diagnostic: existing
base.alias('copy', 'missing');
// diagnostic: service
base.alias(wrong, 'value');
// diagnostic: incompatible
DiBag.begin().bind(wrong, () => 'bad').alias('copy', target);
// diagnostic: incompatible
DiBag.begin().alias('copy', target).bind(wrong, () => 'bad');
// diagnostic: missing factories
DiBag.begin().alias('copy', target).end();
// diagnostic: missing factories
DiBag.begin().install(DiBag.module().alias('copy', target).exports([])).end();
// diagnostic: wrong shape
base.alias('copy', 'value').replace<'value', () => string>('value', () => 'bad');
// diagnostic: wrong shape
DiBag.module().add({ value: () => 1 }).alias('copy', 'value').replace<'value', () => string>('value', () => 'bad');
const exported = DiBag.module().add({ value: () => 1 }).alias('copy', 'value').exports(['value']).rename('value', 'renamed');
// diagnostic: wrong shape
DiBag.begin().install(exported).replace<'renamed', () => string>('renamed', () => 'bad');
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
base.alias('copy', 'value').add({ root }).end();
const transient = DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient');
// diagnostic: root lifetime cannot capture scoped dependency
base.alias('copy', 'value').add({ transient, root: DiBag.withLifetime(({ transient }: { transient: number }) => transient, 'root') }).end();
const privateScoped = DiBag.module().add({ value: () => 1 }).alias('copy', 'value').exports(['copy']).rename('copy', 'renamed');
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateScoped).add({ root: DiBag.withLifetime(({ renamed }: { renamed: number }) => renamed, 'root') }).end();
const privateRoot = DiBag.module().add({ value: () => 1 }).alias('copy', 'value').add({ root }).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateRoot).end();
const transientBag = DiBag.begin().add({ value: DiBag.withLifetime(() => 1, 'transient') }).alias('copy', 'value').end();
// diagnostic: cannot share transient
transientBag.scope({ share: ['copy'] });
const privateTransient = DiBag.module().add({ value: DiBag.withLifetime(() => 1, 'transient') }).alias('copy', 'value').exports(['copy']);
// diagnostic: cannot share transient
DiBag.begin().install(privateTransient).end().scope({ share: ['copy'] });
const original = base.alias('copy', 'value');
// diagnostic: not assignable
const erasedHistory: typeof base = original;
// diagnostic: not assignable
const erasedEmpty: Builder<never> = original;
declare const provider: Provider<() => number>;
declare const union: typeof provider | (() => string);
// diagnostic: wrong shape
original.replace<'value', typeof union>('value', union);
declare const erased: Registration;
// diagnostic: finite string-keyed
original.replace<'value', typeof erased>('value', erased);
const sharingBase = DiBag.begin().add({ value: () => 1, consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').end();
const parentScoped = sharingBase.scope(['value'], { value: DiBag.withLifetime(() => 2, 'root') }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentScoped.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
const rootedTarget = DiBag.begin().add({ value: DiBag.withLifetime(() => 1, 'root'), consumer: ({ copy }: { copy: number }) => copy }).alias('copy', 'value').end();
const parentRoot = rootedTarget.scope(['value'], { value: () => 2 }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.scope(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
parentRoot.fork(['consumer'], { consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency
sharingBase.scope(['value', 'consumer'], { value: DiBag.withLifetime(() => 2, 'root'), consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
const sharedRootConsumer = rootedTarget.scope(['value', 'consumer'], { value: () => 2, consumer: DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'root') }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharedRootConsumer.fork();
const transientOverride = rootedTarget.scope(['value'], { value: DiBag.withLifetime(() => 3, 'transient') }, { share: ['copy'] });
// diagnostic: cannot share transient
transientOverride.scope().scope({ share: ['copy'] });
// diagnostic: cannot share transient
transientOverride.fork().scope({ share: ['copy'] });
const aliasKey = Symbol('alias'); const aliasToken = DiBag.token(aliasKey).of<number>();
const rootOptional = DiBag.withLifetime(DiBag.fromFunction([DiBag.optional(aliasToken)], value => value), 'root');
const rootLazy = DiBag.withLifetime(DiBag.fromFunction([DiBag.lazy(aliasToken)], get => get()), 'root');
// diagnostic: root lifetime cannot capture scoped dependency
base.alias(aliasToken, 'value').add({ rootOptional }).end();
// diagnostic: root lifetime cannot capture scoped dependency
base.alias(aliasToken, 'value').add({ rootLazy }).end();
const externalPrivate = DiBag.module().alias(aliasToken, target).add({ rootLazy }).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().bind(target, () => 1).install(externalPrivate).end();
const moduleHistory = DiBag.module().add({ value: () => 1 });
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
reflectedBuilder.end().resolve('copy');
