import { DiBag } from '../../../src';
// diagnostic: createIndependentContainer accepts existing names or typed tokens only
DiBag.createBuilder().withServices({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).buildContainer().createIndependentContainer(['newClock'], {
    newClock: () => ({
      now() {
        return 7;
      },
    }),
  });
