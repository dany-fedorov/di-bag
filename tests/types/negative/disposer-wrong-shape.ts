import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.providerWithDisposal({ provider: () => 1, disposeService: (value: string) => {
    void value;
  } });
