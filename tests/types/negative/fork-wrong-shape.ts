import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.createBuilder().withServices({ clock: () => 1 }).buildContainer().fork(['clock'], { clock: () => 'wrong' });
