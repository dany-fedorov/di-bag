import { DiBag } from '../../../src';
// diagnostic: wrong shape
DiBag.begin()
  .add({
    clock: () => ({
      now() {
        return 42;
      },
    }),
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  })
  .add({
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
