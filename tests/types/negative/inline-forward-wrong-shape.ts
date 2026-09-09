import { DiBag } from '../../../src';
// diagnostic: wrong shape
DiBag.begin()
  .add({
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
