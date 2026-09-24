import { DiBag as ContainerKit } from 'di-bag';
import * as Library from 'di-bag';

const clock = () => ({ now: () => Date.now() });
const explicit = ContainerKit.providerWithLifetime({ provider: () => ({ id: 'explicit' }), lifetime: 'singleton:one-per-container-tree' });
const decorated = ContainerKit.providerWithDisposal({ provider: () => ({ close() {} }), disposeService: value => value.close() });
const shared = { fromVariable: () => 1 };
const item = ContainerKit.createToken(Symbol('item')).forService<number>();
const items = ContainerKit.createToken(Symbol('items')).forCollectionOf<number>();
const unrelated = { createScope: () => 'user-method' };

const feature = ContainerKit.createBuilder().withServices({
  plain: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
  clock: ContainerKit.providerWithLifetime({ provider: clock, lifetime: 'scoped:one-per-container' }),
  explicit,
  decorated: ContainerKit.providerWithLifetime({ provider: decorated, lifetime: 'scoped:one-per-container' }),
}).buildModule({ exportedServiceKeys: ['plain'] });

export const root = ContainerKit.createBuilder()
  .withServices({ service: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .withInstalledModules([feature])
  .buildContainer();

export const forms = ContainerKit.createBuilder()
  .withTokenService(item, ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }))
  .withCollectionContribution({ collectionToken: items, provider: ContainerKit.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) })
  .withReplacedService(item, ContainerKit.providerWithLifetime({ provider: () => 3, lifetime: 'scoped:one-per-container' }));
export const untouched = unrelated.createScope();

export const empty = root.createChildContainer();
export const child = root.createChildContainer(['service'], { service: ContainerKit.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }) });
export const independent = root.createIndependentContainer(['service'], { service: ContainerKit.providerWithLifetime({ provider: () => 3, lifetime: 'scoped:one-per-container' }) });
export const manual = ContainerKit.createBuilder().withServices(shared).buildContainer();
export const spread = ContainerKit.createBuilder().withServices({ ...shared }).buildContainer();
export const namespaceFeature = Library.DiBag.createBuilder().withServices({ ns: ContainerKit.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
