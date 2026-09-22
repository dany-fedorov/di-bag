import { DiBag } from '../../../src';

const key = Symbol('clock');
const clock = DiBag.token(key).of<{ now(): number }>();
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 'b' })
  .withTokenService(clock, () => ({ now: () => 1 })).buildContainer();

// diagnostic: createIndependentContainer accepts existing names or typed tokens only
root.createIndependentContainer(['missing'], { missing: () => 1 });
// diagnostic: Type '() => string' is not assignable to type
root.createIndependentContainer(['a'], { a: () => 'wrong' });
// diagnostic: Property 'b' is missing
root.createIndependentContainer(['a', 'b'], { a: () => 2 });
// diagnostic: createChildContainer cannot share and replace the same service
root.createChildContainer(['a'], { a: () => 2 }, { sharedParentServiceKeys: ['a'] });
// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
root.createChildContainer({ sharedParentServiceKeys: ['missing'] });
// diagnostic: not assignable to type 'undefined'
root.createIndependentContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 2 } });
// diagnostic: No overload matches this call
root.createChildContainer({ replacedServiceKeys: ['a'], replacementProviders: { a: () => 2 } });
// diagnostic: Type 'undefined' is not assignable to type 'never'
root.createIndependentContainer({ replacedServiceKeys: undefined, replacementProviders: undefined });
// diagnostic: No overload matches this call
root.createChildContainer({ replacedServiceKeys: undefined, replacementProviders: undefined });
// diagnostic: 'extra' does not exist in type
root.createChildContainer(['a'], { a: () => 2 }, { sharedParentServiceKeys: [], extra: true });
// diagnostic: Type of computed property's value is '() => { now: string; }'
root.createIndependentContainer([clock], { [key]: () => ({ now: 'wrong' }) });

const incomplete = DiBag.createBuilder().withServices({
  selected: () => 1,
  consumer: ({ selected }: { selected: number }) => selected,
}).buildContainer();
// diagnostic: Type '({ missing }: { missing: number; }) => number' is not assignable to type
incomplete.createIndependentContainer(['selected'], { selected: ({ missing }: { missing: number }) => missing });

const lifetime = DiBag.createBuilder().withServices({
  db: DiBag.withLifetime(() => 1, 'root'),
  rootService: DiBag.withLifetime(({ db }: { db: number }) => db, 'root'),
}).buildContainer();
// diagnostic: root lifetime cannot capture scoped dependency
lifetime.createIndependentContainer(['db'], { db: () => 2 });

const transient = DiBag.createBuilder().withServices({
  value: DiBag.withLifetime(() => 1, 'transient'),
}).buildContainer();
// diagnostic: createChildContainer cannot share transient providers
transient.createChildContainer([], {}, { sharedParentServiceKeys: ['value'] });
