import { DiBag } from '../../../src';
// diagnostic: required service registrations are missing
DiBag.createBuilder().withServices({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  }).buildContainer();
