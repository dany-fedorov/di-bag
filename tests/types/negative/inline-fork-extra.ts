import { DiBag } from '../../../src';
// diagnostic: fork accepts existing names or typed tokens only
DiBag.createBuilder().withServices({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).buildContainer().fork(['newClock'], {
    newClock: () => ({
      now() {
        return 7;
      },
    }),
  });
