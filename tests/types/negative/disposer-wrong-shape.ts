import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.withDisposal(
  () => 1,
  (value: string) => {
    void value;
  },
);
