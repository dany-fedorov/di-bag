import { DiBag } from '../../../src';
// diagnostic: not assignable
const overrides: object = { clock: 42, extra: () => 1 };
DiBag.createBuilder().withServices({ clock: () => 1 }).buildContainer().fork(['clock'], overrides);
