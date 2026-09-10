import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.createBuilder().register({ clock: () => 1 }).build().fork(['clock'], { clock: () => 'wrong' });
