import { DiBag } from '../../../src/di-bag';
// diagnostic: existing tokens
const overrides = { clock: () => 1, extra: () => 2 };
DiBag.begin()
  .add({ clock: () => 1 })
  .end()
  .fork(overrides);
