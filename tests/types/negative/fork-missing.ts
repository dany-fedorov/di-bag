import { DiBag } from '../../../src/di-bag';
// diagnostic: Type '({ clock }: { clock: number; }) => number' is not assignable to type
DiBag.createBuilder().register({ value: () => 1 }).build().fork(['value'], { value: ({ clock }: { clock: number }) => clock });
