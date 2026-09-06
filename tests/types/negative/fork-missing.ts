import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.begin()
  .add({ value: () => 1 })
  .end()
  .fork(['value'], { value: ({ clock }: { clock: number }) => clock });
