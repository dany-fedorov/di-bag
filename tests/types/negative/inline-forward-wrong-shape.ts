import { DiBag } from '../../../src';
// diagnostic: consumer dependency
DiBag.createBuilder().register({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  }).register({
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
