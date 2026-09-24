import { DiBag, type Container } from '../../../src';

const key: unique symbol = Symbol('service');
const otherKey: unique symbol = Symbol('service');
const token = DiBag.createToken(key).forService<{ readonly value: number }>();
const otherToken = DiBag.createToken(otherKey).forService<{ readonly value: number }>();
const feature = DiBag.createBuilder().withServices({
  hidden: DiBag.providerWithLifetime({ provider: ({ external }: { external: { readonly exact: true } }) => external.exact, lifetime: 'scoped:one-per-container' }),
  publicValue: DiBag.providerWithLifetime({ provider: ({ hidden }: { hidden: true }) => hidden, lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['publicValue'] }).withRenamedExport({ currentExportKey: 'publicValue', newExportKey: 'renamed' });
const root = DiBag.createBuilder().withInstalledModules([feature]).withTokenService(token, DiBag.providerWithLifetime({ provider: () => ({ value: 1 }), lifetime: 'scoped:one-per-container' })).withServices({
  external: DiBag.providerWithLifetime({ provider: () => ({ exact: true as const, visible: 'wider' as const }), lifetime: 'scoped:one-per-container' }),
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
child.createIndependentContainer(['external'], { external: DiBag.providerWithLifetime({ provider: () => ({ exact: false as const, visible: 'wider' as const }), lifetime: 'scoped:one-per-container' }) });
const exportless = DiBag.createBuilder().withServices({
  hidden: DiBag.providerWithLifetime({ provider: ({ external }: { external: { readonly exact: true } }) => external.exact, lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: [] });
const constrainedChild = DiBag.createBuilder().withInstalledModules([exportless]).withServices({
  external: DiBag.providerWithLifetime({ provider: () => ({ exact: true as const }), lifetime: 'scoped:one-per-container' }),
}).buildContainer().createChildContainer();
// diagnostic: is not assignable to type 'Container
const lostConstraint: Container<{ external: () => { readonly exact: true } }> = constrainedChild;
void token;
void lostConstraint;
