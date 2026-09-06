import { DiBag } from '../../../src';
// diagnostic: Type '({ clock }: { clock: { now(): number; }; }) => { stamp(): number; }' is not assignable to type '(ProviderBase &
DiBag.begin()
  .add({
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
  })
  .end()
  .fork(['service'], {
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
    }),
  });
