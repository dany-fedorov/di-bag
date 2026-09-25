import { DiBag } from '../../../src';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({
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
