import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().withServices({
    resource: DiBag.withDisposal(
      ({ clock }: { clock: number }) => clock,
      () => {},
    ),
  }).buildContainer();
