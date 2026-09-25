import { DiBag } from 'di-bag';

const extracted = DiBag.withLifetime(() => ({ value: 1 }), 'root');
const extractedRoot = DiBag.createBuilder().register({ config: extracted, other: extracted }).build();
export const extractedChild = extractedRoot.createScope(['config'], { config: () => ({ value: 2 }) });

const siblingRoot = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ value: 1 }), 'root'),
}).build();
export const replacingSibling = siblingRoot.createScope(['config'], { config: () => ({ value: 2 }) });
export const inheritingSibling = siblingRoot.createScope();

declare const selected: readonly ['config'];
const dynamicRoot = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ value: 1 }), 'root'),
}).build();
export const dynamicChild = dynamicRoot.createScope(selected, { config: () => ({ value: 2 }) });

const falseRoot = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ value: 1 }), 'root'),
  client: DiBag.withLifetime(({ config }: { config: { value: number } }) => config.value, 'root', { allowScopedDependencies: false }),
}).build();
export const falseChild = falseRoot.createScope(['config'], { config: () => ({ value: 2 }) });

const spreadServices = { config: DiBag.withLifetime(() => ({ value: 1 }), 'root') };
const spreadRoot = DiBag.createBuilder().register({ ...spreadServices }).build();
export const spreadChild = spreadRoot.createScope(['config'], { config: () => ({ value: 2 }) });

const firstBuilder = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => ({ value: 1 }), 'root') });
const secondBuilder = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => ({ value: 2 }), 'root') });
const conditionalRoot = (Date.now() > 0 ? firstBuilder : secondBuilder).build();
export const conditionalChild = conditionalRoot.createScope(['config'], { config: () => ({ value: 3 }) });

const local = { createScope: (keys: readonly string[]) => keys };
export const localChild = local.createScope(['config']);

const inheritedRoot = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ value: 1 }), 'root'),
  other: () => 1,
}).build();
const otherChild = inheritedRoot.createScope(['other'], { other: () => 2 });
export const inheritedGrandchild = otherChild.createScope(['config'], { config: () => ({ value: 3 }) });
