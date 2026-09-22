import { DiBag } from '../../../src/di-bag';
// diagnostic: Promise<number>
const value: number = DiBag.createBuilder().withServices({ clock: async () => 1 }).buildContainer().resolve('clock');
void value;
