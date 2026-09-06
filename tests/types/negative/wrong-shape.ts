import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
DiBag.begin()
  .add({ clock: () => 'wrong' })
  .add({ service: ({ clock }: { clock: number }) => clock });
