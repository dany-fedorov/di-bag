import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
DiBag.begin()
  .add({ value: () => 1, clock: () => 'wrong' })
  .end()
  .fork({ value: ({ clock }: { clock: number }) => clock });
