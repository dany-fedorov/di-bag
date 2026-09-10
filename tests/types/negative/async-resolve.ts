import { DiBag } from '../../../src/di-bag';
// diagnostic: Promise<number>
const value: number = DiBag.createBuilder().register({ clock: async () => 1 }).build().resolve('clock');
void value;
