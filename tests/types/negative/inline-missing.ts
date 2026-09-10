import { DiBag } from '../../../src';
// diagnostic: required service registrations are missing
DiBag.createBuilder().register({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  }).build();
