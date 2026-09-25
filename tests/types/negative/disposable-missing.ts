import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().withServices({
    resource: DiBag.providerWithDisposal({ provider: ({ clock }: { clock: number }) => clock, disposeService: () => {} }),
  }).buildContainer();
