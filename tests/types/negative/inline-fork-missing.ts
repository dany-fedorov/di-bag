import { DiBag } from '../../../src';
// diagnostic: Type '({ clock }: { clock: { now(): number; }; }) => { stamp(): number; }' is not assignable to type
DiBag.createBuilder().withServices({
    service: () => ({
      stamp(): number {
        return 42;
      },
    }),
  }).buildContainer().createIndependentContainer(['service'], {
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  });
