import { DiBag } from '../../../src';

const root = DiBag.createBuilder().withServices({
  singleton: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }),
  scoped: () => 2,
}).buildContainer();
root.createChildContainer(
  ['singleton'],
  // diagnostic: createChildContainer cannot replace singleton service: singleton
  { singleton: () => 3 },
);

const tokenKey = Symbol('singleton');
const token = DiBag.createToken(tokenKey).forService<number>();
const tokenRoot = DiBag.createBuilder().withTokenService(token, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' })).buildContainer();
tokenRoot.createChildContainer(
  [token],
  // diagnostic: createChildContainer cannot replace singleton service
  { [token.symbol]: () => 2 },
);

const aliasRoot = DiBag.createBuilder()
  .withServices({ target: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }) })
  .withServiceAlias({ aliasKey: 'alias', targetServiceKey: 'target' })
  .buildContainer();
aliasRoot.createChildContainer(
  ['alias'],
  // diagnostic: createChildContainer cannot replace singleton service: alias
  { alias: () => 2 },
);
