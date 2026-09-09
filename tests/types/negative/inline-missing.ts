import { DiBag } from '../../../src';
// diagnostic: missing factories
DiBag.begin()
  .add({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  })
  .end();
