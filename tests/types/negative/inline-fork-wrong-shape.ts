import { DiBag } from '../../../src';
// diagnostic: override value is not assignable
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
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
