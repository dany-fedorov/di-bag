import { DiBag } from '../../../src/di-bag';
// diagnostic: assignable
DiBag.withDisposal(
  async () => 1,
  (value: Promise<number>) => {
    void value;
  },
);
