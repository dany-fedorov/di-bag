import { DiBag } from '../../../src/di-bag';
// diagnostic: existing names or typed tokens
const overrides = { clock: () => 1, extra: () => 2 };
DiBag.createBuilder().register({ clock: () => 1 }).build().fork(['clock', 'extra'], overrides);
