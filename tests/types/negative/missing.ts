import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().withServices({ service: ({ clock }: { clock: number }) => clock }).buildContainer();
