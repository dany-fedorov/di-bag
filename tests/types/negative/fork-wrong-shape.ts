import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.begin()
  .add({ clock: () => 1 })
  .end()
  .fork(['clock'], { clock: () => 'wrong' });
