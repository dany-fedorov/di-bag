import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
DiBag.begin()
  .add({ clock: () => 1, service: ({ clock }: { clock: number }) => clock })
  .add({ clock: () => 'wrong' });
