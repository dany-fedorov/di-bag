import { DiBag as Alias } from '../../../../src/index.js';
const token = Alias.createToken(Symbol('value')).forService<number>();
export const container = Alias.createBuilder()
  .withServices({ named: Alias.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) })
  .withTokenService(token, Alias.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' }))
  .buildContainer();
