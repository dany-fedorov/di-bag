import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.begin()
  .add({ service: ({ clock }: { clock: number }) => clock })
  .end();
