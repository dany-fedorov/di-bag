import { DiBag as Alias } from '../../../../src/index.js';
const token = Alias.createToken(Symbol('value')).forService<number>();
export const container = Alias.createBuilder()
  .withServices({ named: () => 1 })
  .withTokenService(token, () => 2)
  .buildContainer();
