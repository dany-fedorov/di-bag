import { DiBag } from '../../../src/di-bag';
// diagnostic: Type '({ clock }: { clock: number; }) => number' is not assignable to type
DiBag.createBuilder().withServices({ value: () => 1 }).buildContainer().fork(['value'], { value: ({ clock }: { clock: number }) => clock });
