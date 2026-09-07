import { DiBag } from '../../../src';
// diagnostic: Type '() => { now(): string; }' is not assignable to type
DiBag.begin()
  .add({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  })
  .end()
  .fork(['clock'], {
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
