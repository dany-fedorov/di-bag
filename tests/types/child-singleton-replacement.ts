import { DiBag, type CanonicalLifetime, type Container, type ProviderOrFactory } from '../../src';
import type { NeedConstraint } from '../../src/module-types';

const root = DiBag.createBuilder().withServices({
  scoped: () => 1,
  singleton: DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();

export const child = root.createChildContainer(['scoped'], { scoped: () => 3 });
export const independent = root.createIndependentContainer(['singleton'], { singleton: () => 4 });
const itemsKey = Symbol('items');
export const items = DiBag.createToken(itemsKey).forCollectionOf<number>();
const collectionRoot = DiBag.createBuilder()
  .withCollectionContribution({ collectionToken: items, provider: () => 1 })
  .buildContainer();
export const collectionChild = collectionRoot.createChildContainer([items], { [items.symbol]: () => [2] });
export const singletonCollectionChild = collectionRoot.createChildContainer([items], {
  [items.symbol]: DiBag.providerWithLifetime({ provider: () => [2], lifetime: 'singleton:one-per-container-tree' }),
});
export const repeatedCollectionChild = singletonCollectionChild.createChildContainer([items], { [items.symbol]: () => [3] });
const childValue: number = child.resolve('scoped');
const independentValue: number = independent.resolve('singleton');
const collectionValue: readonly number[] = collectionChild.resolveCollection(items);
const repeatedCollectionValue: readonly number[] = repeatedCollectionChild.resolveCollection(items);
type Registrations = typeof root extends Container<infer R extends Record<string, ProviderOrFactory>, infer _C extends NeedConstraint> ? R : never;
const scopedLifetime: CanonicalLifetime<Registrations, 'scoped'> = 'scoped:one-per-container';
const singletonLifetime: CanonicalLifetime<Registrations, 'singleton'> = 'singleton:one-per-container-tree';
void childValue; void independentValue; void collectionValue; void repeatedCollectionValue; void scopedLifetime; void singletonLifetime;
