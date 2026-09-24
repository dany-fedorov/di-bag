import { DiBag, type Container } from '../../../src';

const key: unique symbol = Symbol('service');
const otherKey: unique symbol = Symbol('service');
const token = DiBag.createToken(key).forService<{ readonly value: number }>();
const otherToken = DiBag.createToken(otherKey).forService<{ readonly value: number }>();
const feature = DiBag.createBuilder().withServices({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
  publicValue: ({ hidden }: { hidden: true }) => hidden,
}).buildModule({ exportedServiceKeys: ['publicValue'] }).withRenamedExport({ currentExportKey: 'publicValue', newExportKey: 'renamed' });
const root = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, () => ({ value: 1 })).withServices({
  external: () => ({ exact: true as const, visible: 'wider' as const }),
}).buildContainer();
const child = root.createChildContainer();
// diagnostic: createChildContainer sharedParentServiceKeys accepts existing names or typed tokens only
root.createChildContainer({ sharedParentServiceKeys: ['missing'] });
root.createChildContainer(undefined);
// diagnostic: not assignable
child.resolve('missing');
// diagnostic: not assignable
child.resolve('hidden');
// diagnostic: not assignable
child.resolve(otherToken);
// diagnostic: Type '() => { exact: false
child.createIndependentContainer(['external'], { external: () => ({ exact: false as const, visible: 'wider' as const }) });
const exportless = DiBag.createBuilder().withServices({
  hidden: ({ external }: { external: { readonly exact: true } }) => external.exact,
}).buildModule({ exportedServiceKeys: [] });
const constrainedChild = DiBag.createBuilder().withInstalledModules([exportless]).withServices({
  external: () => ({ exact: true as const }),
}).buildContainer().createChildContainer();
// diagnostic: is not assignable to type 'Container
const lostConstraint: Container<{ external: () => { readonly exact: true } }> = constrainedChild;
void token;
void lostConstraint;
