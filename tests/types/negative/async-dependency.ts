import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
DiBag.begin()
  .add({ clock: async () => 1 })
  .add({ service: ({ clock }: { clock: number }) => clock });
