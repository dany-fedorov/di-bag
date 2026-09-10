import { DiBag } from '../../../src';
// diagnostic: not assignable
const overrides: object = { clock: 42, extra: () => 1 };
DiBag.createBuilder().register({ clock: () => 1 }).build().fork(['clock'], overrides);
