import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
DiBag.begin()
  .add({ service: ({ clock }: { clock: number }) => clock })
  .add({ clock: () => 'wrong' });
