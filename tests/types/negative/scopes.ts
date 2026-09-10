import { DiBag, type Bag } from '../../../src';

const key: unique symbol = Symbol('service');
const otherKey: unique symbol = Symbol('service');
const token = DiBag.token(key).of<{ readonly value: number }>();
const otherToken = DiBag.token(otherKey).of<{ readonly value: number }>();
const feature = DiBag.createModuleBuilder().register({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
  publicValue: ({ hidden }: { hidden: true }) => hidden,
}).buildModule(['publicValue']).renameExport('publicValue', 'renamed');
const root = DiBag.createBuilder().installModule(feature).register(token, () => ({ value: 1 })).register({
  external: () => ({ exact: true as const, visible: 'wider' as const }),
}).build();
const child = root.createScope();
// diagnostic: createScope share accepts existing names or typed tokens only
root.createScope({ share: ['missing'] });
// diagnostic: not assignable
root.createScope(undefined);
// diagnostic: not assignable
child.resolve('missing');
// diagnostic: not assignable
child.resolve('hidden');
// diagnostic: not assignable
child.resolve(otherToken);
// diagnostic: Type '() => { exact: false
child.fork(['external'], { external: () => ({ exact: false as const, visible: 'wider' as const }) });
const exportless = DiBag.createModuleBuilder().register({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
}).buildModule([]);
const constrainedChild = DiBag.createBuilder().installModule(exportless).register({
  external: () => ({ exact: true as const }),
}).build().createScope();
// diagnostic: is not assignable to type 'Bag
const lostConstraint: Bag<{ external: () => { readonly exact: true } }> = constrainedChild;
void token;
void lostConstraint;
