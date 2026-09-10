import { DiBag } from '../../../src';
// diagnostic: consumer dependency
DiBag.createBuilder().register({
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
  }).replace('clock', () => ({
    now() {
      return 'wrong';
    },
  }));
