import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.begin()
  .add({
    resource: DiBag.withDisposal(
      ({ clock }: { clock: number }) => clock,
      () => {},
    ),
  })
  .end();
