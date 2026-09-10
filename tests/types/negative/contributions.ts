import { DiBag, type BagBuilder, type Bag } from '../../../src';
const key = Symbol('numbers'); const numbers = DiBag.token(key).of<number>();
const wrong = DiBag.token(key).of<string>();
// diagnostic: service
DiBag.createBuilder().contribute(numbers, () => 'wrong');
const builder = DiBag.createBuilder().contribute(numbers, () => 1);
// diagnostic: incompatible
builder.contribute(wrong, () => 'wrong');
// diagnostic: incompatible
builder.build().resolveAll(wrong);
// diagnostic: existing
builder.build().resolve(numbers);
// diagnostic: required service registrations are missing
DiBag.createBuilder().contribute(numbers, ({ missing }: { missing: number }) => missing).build();
// diagnostic: not assignable
const erasedBuilder: BagBuilder<never> = builder;
// diagnostic: not assignable
const erasedBag: Bag<{}> = builder.build();
const all = DiBag.all(numbers);
const rootAll = DiBag.withLifetime(DiBag.fromFunction([all], values => values), 'root');
// diagnostic: root lifetime cannot capture scoped dependency
builder.register({ rootAll }).build();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).register({ helper: () => 1 }).build();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).register({ helper: () => 1, rootAll }).build();
const privateScoped = DiBag.createModuleBuilder().register({ helper: () => 1 }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateScoped).register({ rootAll }).build();
const privateRoot = DiBag.createModuleBuilder().register({ helper: () => 1 }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).build();
// diagnostic: incompatible
DiBag.createBuilder().register({ all: DiBag.fromFunction([all], values => values) }).contribute(wrong, () => 'wrong');
// diagnostic: incompatible
builder.register({ all: DiBag.fromFunction([DiBag.all(wrong)], values => values) });
const privateAll = DiBag.createModuleBuilder().register({ privateAll: DiBag.fromFunction([all], values => values) }).buildModule([]);
// diagnostic: incompatible
DiBag.createBuilder().installModule(privateAll).contribute(wrong, () => 'wrong');
// diagnostic: incompatible
DiBag.createBuilder().contribute(wrong, () => 'wrong').installModule(privateAll);
// diagnostic: incompatible
DiBag.createModuleBuilder().contribute(numbers, () => 1).register({ all: DiBag.fromFunction([DiBag.all(wrong)], values => values) });
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(DiBag.createModuleBuilder().contribute(numbers, ({ missing }: { missing: number }) => missing).buildModule([])).build();
// diagnostic: consumer dependency
DiBag.createBuilder().contribute(numbers, ({ value }: { value: number }) => value).register({ value: () => 'bad' });
// diagnostic: consumer dependency
DiBag.createModuleBuilder().contribute(numbers, ({ value }: { value: number }) => value).register({ value: () => 'bad' });
const dependency = DiBag.createBuilder().register({ helper: () => 1 }).contribute(numbers, ({ helper }: { helper: number }) => helper);
// diagnostic: consumer dependency
dependency.replace<'helper', () => string>('helper', () => 'wrong');
// diagnostic: not assignable
const erasedModule: ReturnType<ReturnType<typeof DiBag.createModuleBuilder>['buildModule']> = DiBag.createModuleBuilder().contribute(numbers, () => 1).buildModule([]);
// diagnostic: not assignable
const erasedModuleBuilder: ReturnType<typeof DiBag.createModuleBuilder> = DiBag.createModuleBuilder().contribute(numbers, () => 1);
// diagnostic: not assignable
DiBag.all({});
// diagnostic: not assignable
DiBag.all(DiBag.optional(numbers));
// diagnostic: Expected 2 arguments
DiBag.all<never>(numbers as never);
// diagnostic: Expected 3 arguments
builder.contribute<never, () => number>(numbers as never, () => 1);
// diagnostic: Expected 3 arguments
builder.contribute<typeof numbers, never>(numbers, undefined as never);
declare const erased: import('../../../src').Registration;
// diagnostic: not assignable
builder.contribute(numbers, erased);
const otherKey = Symbol('other'); const other = DiBag.token(otherKey).of<number>();
declare const union: typeof numbers | typeof other;
// diagnostic: finite tuple
builder.contribute(union, () => 1);
// diagnostic: finite tuple
builder.build().resolveAll(union);
// diagnostic: not assignable
const allReflected: ReturnType<typeof DiBag.all> = all;
// diagnostic: finite tuple
DiBag.fromFunction([allReflected], values => values);
declare const reflected: ReturnType<typeof builder.contribute>;
// diagnostic: required service registrations are missing
reflected.build();
// diagnostic: not assignable
const badInspection: readonly { metadata: { label: string } }[] = builder.build().inspectAll(numbers);

const privateTransientHelper = DiBag.createModuleBuilder().register({ leaf: () => 1, helper: DiBag.withLifetime(({ leaf }: { leaf: number }) => leaf, 'transient') }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateTransientHelper).register({ rootAll }).build();
const scopedBag = builder.register({ consumer: DiBag.fromFunction([all], values => values) }).build();
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.createScope(['consumer'], { consumer: rootAll });
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.fork(['consumer'], { consumer: rootAll });
const scopedAliasFeature = DiBag.createModuleBuilder().register({ helper: () => 1 }).alias('copy', 'helper').contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(scopedAliasFeature).register({ rootAll }).build();
const needsTwo = DiBag.createModuleBuilder().contribute(numbers, ({ external }: { external: number }) => external).contribute(numbers, ({ external }: { external: string }) => external.length).buildModule([]);
// diagnostic: consumer dependency
DiBag.createBuilder().installModule(needsTwo).register({ external: () => 1 });
const tokenKey = Symbol('dependency'); const required = DiBag.token(tokenKey).of<number>(); const wrongRequired = DiBag.token(tokenKey).of<string>();
// diagnostic: incompatible
DiBag.createBuilder().contribute(numbers, DiBag.fromFunction([DiBag.optional(required)], value => value ?? 0)).register(wrongRequired, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().contribute(numbers, DiBag.fromFunction([DiBag.lazy(required)], get => get())).build();
// diagnostic: incompatible
DiBag.createBuilder().contribute(numbers, DiBag.fromFunction([DiBag.lazy(required)], get => get())).register(wrongRequired, () => 'wrong');
// diagnostic: required service registrations are missing
DiBag.createBuilder().installModule(DiBag.createModuleBuilder().contribute(numbers, DiBag.fromFunction([required], value => value)).buildModule([])).build();
// diagnostic: incompatible
DiBag.createBuilder().installModule(DiBag.createModuleBuilder().contribute(numbers, DiBag.fromFunction([DiBag.all(wrong)], values => values.length)).buildModule([])).contribute(numbers, () => 1);
// diagnostic: not assignable
const forgedToken: Parameters<typeof builder.contribute>[0] = numbers;
// diagnostic: Expected 2 arguments
builder.build().resolveAll<never>(numbers as never);
// diagnostic: Expected 2 arguments
builder.build().inspectAll<never>(numbers as never);
const rooted = DiBag.withLifetime(() => 1, 'root');
const sharedAliasBase = DiBag.createBuilder().register({ helper: () => 1, consumer: DiBag.fromFunction([all], values => values) }).alias('copy', 'helper').contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).build();
// diagnostic: root lifetime cannot capture scoped dependency
sharedAliasBase.createScope(['helper', 'consumer'], { helper: rooted, consumer: rootAll }, { share: ['copy'] });
const sharedRootAliasBase = DiBag.createBuilder().register({ helper: rooted, consumer: DiBag.fromFunction([all], values => values) }).alias('copy', 'helper').contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).build();
const sharedRootAlias = sharedRootAliasBase.createScope(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharedRootAlias.fork();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().contribute(numbers, rooted).contribute(numbers, () => 1).register({ rootAll }).build();
