import { DiBag } from '../../../src';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  }).withServices({
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
  });
