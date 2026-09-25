import { DiBag } from '../../../src';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({
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
  }).withReplacedService('clock', () => ({
    now() {
      return 'wrong';
    },
  }));
