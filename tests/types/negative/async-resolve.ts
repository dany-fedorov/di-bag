import { DiBag } from '../../../src/di-bag';
// diagnostic: Promise<number>
const value: number = DiBag.begin()
  .add({ clock: async () => 1 })
  .end()
  .resolve('clock');
void value;
