import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().register({
    resource: DiBag.withDisposal(
      ({ clock }: { clock: number }) => clock,
      () => {},
    ),
  }).build();
