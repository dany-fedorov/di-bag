import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.providerWithDisposal({ provider: async () => 1, disposeService: (value: Promise<number>) => {
    void value;
  } });
