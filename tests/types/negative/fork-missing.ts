import { DiBag } from '../../../src/di-bag';
// diagnostic: Type '({ clock }: { clock: number; }) => number' is not assignable to type '(DisposableFactory<
DiBag.begin()
  .add({ value: () => 1 })
  .end()
  .fork(['value'], { value: ({ clock }: { clock: number }) => clock });
