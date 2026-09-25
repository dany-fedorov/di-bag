import { DiBag } from 'di-bag';

const extracted = DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' });
const extractedRoot = DiBag.createBuilder().withServices({ config: extracted, other: extracted }).buildContainer();
export const extractedChild = extractedRoot.createChildContainer(['config'], { config: () => ({ value: 2 }) });

const siblingRoot = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
export const replacingSibling = siblingRoot.createChildContainer(['config'], { config: () => ({ value: 2 }) });
export const inheritingSibling = siblingRoot.createChildContainer();

declare const selected: readonly ['config'];
const dynamicRoot = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
export const dynamicChild = dynamicRoot.createChildContainer(selected, { config: () => ({ value: 2 }) });

const falseRoot = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }),
  client: DiBag.providerWithLifetime({ provider: ({ config }: { config: { value: number } }) => config.value, lifetime: 'singleton:one-per-container-tree', allowsScopedDependencies: false }),
}).buildContainer();
export const falseChild = falseRoot.createChildContainer(['config'], { config: () => ({ value: 2 }) });

const spreadServices = { config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }) };
const spreadRoot = DiBag.createBuilder().withServices({ ...spreadServices }).buildContainer();
export const spreadChild = spreadRoot.createChildContainer(['config'], { config: () => ({ value: 2 }) });

const firstBuilder = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }) });
const secondBuilder = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => ({ value: 2 }), lifetime: 'singleton:one-per-container-tree' }) });
const conditionalRoot = (Date.now() > 0 ? firstBuilder : secondBuilder).buildContainer();
export const conditionalChild = conditionalRoot.createChildContainer(['config'], { config: () => ({ value: 3 }) });

const local = { createScope: (keys: readonly string[]) => keys };
export const localChild = local.createScope(['config']);

const inheritedRoot = DiBag.createBuilder().withServices({
  config: DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'singleton:one-per-container-tree' }),
  other: () => 1,
}).buildContainer();
const otherChild = inheritedRoot.createChildContainer(['other'], { other: () => 2 });
export const inheritedGrandchild = otherChild.createChildContainer(['config'], { config: () => ({ value: 3 }) });
