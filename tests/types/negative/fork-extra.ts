import { DiBag } from '../../../src/di-bag';
// diagnostic: existing names or typed tokens
const overrides = { clock: () => 1, extra: () => 2 };
DiBag.createBuilder().withServices({ clock: () => 1 }).buildContainer().createIndependentContainer(['clock', 'extra'], overrides);
