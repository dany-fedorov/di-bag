import { DiBag } from 'di-bag/node';

const nodeOnly = DiBag.providerWithLifetime({
  provider: DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} }),
  lifetime: 'singleton:one-per-container-tree',
});

export const container = DiBag.createBuilder().withServices({ nodeOnly }).buildContainer();
