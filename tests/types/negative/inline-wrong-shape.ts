import { DiBag } from '../../../src';
// diagnostic: wrong shape
DiBag.begin().add({
  clock: () => ({
    now() {
      return 'wrong';
    },
  }),
  service: ({ clock }: { clock: { now(): number } }) => ({
    stamp() {
      return clock.now();
    },
  }),
});
