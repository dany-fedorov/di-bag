import { DiBag, type Bag } from '../../../src';

const key: unique symbol = Symbol('service');
const otherKey: unique symbol = Symbol('service');
const token = DiBag.token(key).of<{ readonly value: number }>();
const otherToken = DiBag.token(otherKey).of<{ readonly value: number }>();
const feature = DiBag.createBuilder().withServices({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
  publicValue: ({ hidden }: { hidden: true }) => hidden,
}).buildModule({ exportedServiceKeys: ['publicValue'] }).renameExport('publicValue', 'renamed');
const root = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, () => ({ value: 1 })).withServices({
  external: () => ({ exact: true as const, visible: 'wider' as const }),
}).buildContainer();
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
const exportless = DiBag.createBuilder().withServices({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
}).buildModule({ exportedServiceKeys: [] });
const constrainedChild = DiBag.createBuilder().withInstalledModules([exportless]).withServices({
  external: () => ({ exact: true as const }),
}).buildContainer().createScope();
// diagnostic: is not assignable to type 'Bag
const lostConstraint: Bag<{ external: () => { readonly exact: true } }> = constrainedChild;
void token;
void lostConstraint;
