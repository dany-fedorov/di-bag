import { DiBag } from '../../../src';
// diagnostic: fork accepts existing tokens only
DiBag.begin()
  .add({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  })
  .end()
  .fork({
    newClock: () => ({
      now() {
        return 7;
      },
    }),
  });
