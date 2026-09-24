import { DiBag } from 'di-bag';

const provider = DiBag.providerWithDisposal({ provider: () => 1, disposeService: () => {} });
const explicitProvider = DiBag.providerWithLifetime({
  provider: provider,
  lifetime: 'singleton:one-per-container-tree',
});
const shorthandProvider = DiBag.providerWithLifetime({
  provider,
  lifetime: 'singleton:one-per-container-tree',
});

export const container = DiBag.createBuilder()
  .withServices({ explicitProvider, shorthandProvider })
  .buildContainer();
