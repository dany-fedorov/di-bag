import { DiBag } from '../../../src';
// diagnostic: fork accepts existing names or typed tokens only
DiBag.createBuilder().register({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).build().fork(['newClock'], {
    newClock: () => ({
      now() {
        return 7;
      },
    }),
  });
