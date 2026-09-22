import { DiBag } from '../../../src';
// diagnostic: Type '() => { now(): string; }' is not assignable to type
DiBag.createBuilder().withServices({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).buildContainer().fork(['clock'], {
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
