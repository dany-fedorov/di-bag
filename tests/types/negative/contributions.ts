import { DiBag, type Builder, type Bag } from '../../../src';
const key = Symbol('numbers'); const numbers = DiBag.token(key).of<number>();
const wrong = DiBag.token(key).of<string>();
// diagnostic: service
DiBag.begin().contribute(numbers, () => 'wrong');
const builder = DiBag.begin().contribute(numbers, () => 1);
// diagnostic: incompatible
builder.contribute(wrong, () => 'wrong');
// diagnostic: incompatible
builder.end().resolveAll(wrong);
// diagnostic: existing
builder.end().resolve(numbers);
// diagnostic: missing factories
DiBag.begin().contribute(numbers, ({ missing }: { missing: number }) => missing).end();
// diagnostic: not assignable
const erasedBuilder: Builder<never> = builder;
// diagnostic: not assignable
const erasedBag: Bag<{}> = builder.end();
const all = DiBag.all(numbers);
const rootAll = DiBag.withLifetime(DiBag.fromTokens([all], values => values), 'root');
// diagnostic: root lifetime cannot capture scoped dependency
builder.add({ rootAll }).end();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).add({ helper: () => 1 }).end();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).add({ helper: () => 1, rootAll }).end();
const privateScoped = DiBag.module().add({ helper: () => 1 }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateScoped).add({ rootAll }).end();
const privateRoot = DiBag.module().add({ helper: () => 1 }).contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root')).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateRoot).end();
// diagnostic: incompatible
DiBag.begin().add({ all: DiBag.fromTokens([all], values => values) }).contribute(wrong, () => 'wrong');
// diagnostic: incompatible
builder.add({ all: DiBag.fromFunction([DiBag.all(wrong)], values => values) });
const privateAll = DiBag.module().add({ privateAll: DiBag.fromTokens([all], values => values) }).exports([]);
// diagnostic: incompatible
DiBag.begin().install(privateAll).contribute(wrong, () => 'wrong');
// diagnostic: incompatible
DiBag.begin().contribute(wrong, () => 'wrong').install(privateAll);
// diagnostic: incompatible
DiBag.module().contribute(numbers, () => 1).add({ all: DiBag.fromFunction([DiBag.all(wrong)], values => values) });
// diagnostic: missing factories
DiBag.begin().install(DiBag.module().contribute(numbers, ({ missing }: { missing: number }) => missing).exports([])).end();
// diagnostic: wrong shape
DiBag.begin().contribute(numbers, ({ value }: { value: number }) => value).add({ value: () => 'bad' });
// diagnostic: wrong shape
DiBag.module().contribute(numbers, ({ value }: { value: number }) => value).add({ value: () => 'bad' });
const dependency = DiBag.begin().add({ helper: () => 1 }).contribute(numbers, ({ helper }: { helper: number }) => helper);
// diagnostic: wrong shape
dependency.replace<'helper', () => string>('helper', () => 'wrong');
// diagnostic: not assignable
const erasedModule: ReturnType<ReturnType<typeof DiBag.module>['exports']> = DiBag.module().contribute(numbers, () => 1).exports([]);
// diagnostic: not assignable
const erasedModuleBuilder: ReturnType<typeof DiBag.module> = DiBag.module().contribute(numbers, () => 1);
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
builder.end().resolveAll(union);
// diagnostic: not assignable
const allReflected: ReturnType<typeof DiBag.all> = all;
// diagnostic: finite tuple
DiBag.fromFunction([allReflected], values => values);
declare const reflected: ReturnType<typeof builder.contribute>;
// diagnostic: missing factories
reflected.end();
// diagnostic: not assignable
const badInspection: readonly { metadata: { label: string } }[] = builder.end().inspectAll(numbers);

const privateTransientHelper = DiBag.module().add({ leaf: () => 1, helper: DiBag.withLifetime(({ leaf }: { leaf: number }) => leaf, 'transient') })
  .contribute(numbers, DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'transient')).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(privateTransientHelper).add({ rootAll }).end();
const scopedBag = builder.add({ consumer: DiBag.fromTokens([all], values => values) }).end();
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.scope(['consumer'], { consumer: rootAll });
// diagnostic: root lifetime cannot capture scoped dependency
scopedBag.fork(['consumer'], { consumer: rootAll });
const scopedAliasFeature = DiBag.module().add({ helper: () => 1 }).alias('copy', 'helper')
  .contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).exports([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().install(scopedAliasFeature).add({ rootAll }).end();
const needsTwo = DiBag.module().contribute(numbers, ({ external }: { external: number }) => external)
  .contribute(numbers, ({ external }: { external: string }) => external.length).exports([]);
// diagnostic: wrong shape
DiBag.begin().install(needsTwo).add({ external: () => 1 });
const tokenKey = Symbol('dependency'); const required = DiBag.token(tokenKey).of<number>(); const wrongRequired = DiBag.token(tokenKey).of<string>();
// diagnostic: incompatible
DiBag.begin().contribute(numbers, DiBag.fromTokens([DiBag.optional(required)], value => value ?? 0)).bind(wrongRequired, () => 'wrong');
// diagnostic: missing factories
DiBag.begin().contribute(numbers, DiBag.fromTokens([DiBag.lazy(required)], get => get())).end();
// diagnostic: incompatible
DiBag.begin().contribute(numbers, DiBag.fromTokens([DiBag.lazy(required)], get => get())).bind(wrongRequired, () => 'wrong');
// diagnostic: missing factories
DiBag.begin().install(DiBag.module().contribute(numbers, DiBag.fromTokens([required], value => value)).exports([])).end();
// diagnostic: incompatible
DiBag.begin().install(DiBag.module().contribute(numbers, DiBag.fromTokens([DiBag.all(wrong)], values => values.length)).exports([])).contribute(numbers, () => 1);
// diagnostic: not assignable
const forgedToken: Parameters<typeof builder.contribute>[0] = numbers;
// diagnostic: Expected 2 arguments
builder.end().resolveAll<never>(numbers as never);
// diagnostic: Expected 2 arguments
builder.end().inspectAll<never>(numbers as never);
const rooted = DiBag.withLifetime(() => 1, 'root');
const sharedAliasBase = DiBag.begin().add({ helper: () => 1, consumer: DiBag.fromTokens([all], values => values) }).alias('copy', 'helper')
  .contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).end();
// diagnostic: root lifetime cannot capture scoped dependency
sharedAliasBase.scope(['helper', 'consumer'], { helper: rooted, consumer: rootAll }, { share: ['copy'] });
const sharedRootAliasBase = DiBag.begin().add({ helper: rooted, consumer: DiBag.fromTokens([all], values => values) }).alias('copy', 'helper')
  .contribute(numbers, DiBag.withLifetime(({ copy }: { copy: number }) => copy, 'transient')).end();
const sharedRootAlias = sharedRootAliasBase.scope(['helper', 'consumer'], { helper: () => 2, consumer: rootAll }, { share: ['copy'] });
// diagnostic: root lifetime cannot capture scoped dependency
sharedRootAlias.fork();
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.begin().contribute(numbers, rooted).contribute(numbers, () => 1).add({ rootAll }).end();
