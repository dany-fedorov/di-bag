import { DiBag } from '../../../src';
// diagnostic: missing factories
DiBag.begin()
  .add({
    service: () => ({
      stamp(): number {
        return 42;
      },
    }),
  })
  .end()
  .fork(['service'], {
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  });
