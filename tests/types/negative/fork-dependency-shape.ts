import { DiBag } from '../../../src/di-bag';
// diagnostic: Type '({ clock }: { clock: number; }) => number' is not assignable to type '(ProviderBase &
DiBag.begin()
  .add({ value: () => 1, clock: () => 'wrong' })
  .end()
  .fork(['value'], { value: ({ clock }: { clock: number }) => clock });
