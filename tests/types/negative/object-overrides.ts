import { DiBag } from '../../../src';
// diagnostic: not assignable
const overrides: object = { clock: 42, extra: () => 1 };
DiBag.begin()
  .add({ clock: () => 1 })
  .end()
  .fork(overrides);
