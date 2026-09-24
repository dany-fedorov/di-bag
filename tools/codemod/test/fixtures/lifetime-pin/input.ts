import { DiBag as ContainerKit } from 'di-bag';
import * as Library from 'di-bag';

const clock = () => ({ now: () => Date.now() });
const explicit = ContainerKit.withLifetime(() => ({ id: 'explicit' }), 'root');
const decorated = ContainerKit.withDisposal(() => ({ close() {} }), value => value.close());
const shared = { fromVariable: () => 1 };
const item = ContainerKit.token(Symbol('item')).of<number>();
const items = ContainerKit.token(Symbol('items')).of<number>();
const unrelated = { createScope: () => 'user-method' };

const feature = ContainerKit.createBuilder().register({
  plain: () => 1,
  clock,
  explicit,
  decorated,
}).buildModule(['plain']);

export const root = ContainerKit.createBuilder()
  .register({ service: () => 1 })
  .installModule(feature)
  .build();

export const forms = ContainerKit.createBuilder()
  .register(item, () => 1)
  .contribute(items, () => 2)
  .replace(item, () => 3);
export const untouched = unrelated.createScope();

export const empty = root.createScope();
export const child = root.createScope(['service'], { service: () => 2 });
export const independent = root.fork(['service'], { service: () => 3 });
export const manual = ContainerKit.createBuilder().register(shared).build();
export const spread = ContainerKit.createBuilder().register({ ...shared }).build();
export const namespaceFeature = Library.DiBag.createBuilder().register({ ns: () => 1 }).build();
