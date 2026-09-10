import { DiBag } from '../../../src';
// diagnostic: Type '() => { now(): string; }' is not assignable to type
DiBag.createBuilder().register({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).build().fork(['clock'], {
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
