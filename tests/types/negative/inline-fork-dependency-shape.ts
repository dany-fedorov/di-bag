import { DiBag } from '../../../src';
// diagnostic: Type '({ clock }: { clock: { now(): number; }; }) => { stamp(): number; }' is not assignable to type
DiBag.createBuilder().register({
    clock: () => ({
      now() {
        return 'wrong';
      },
    }),
    service: () => ({
      stamp(): number {
        return 42;
      },
    }),
  }).build().fork(['service'], {
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  });
