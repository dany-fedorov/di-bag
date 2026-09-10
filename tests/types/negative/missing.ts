import { DiBag } from '../../../src/di-bag';
// diagnostic: missing
DiBag.createBuilder().register({ service: ({ clock }: { clock: number }) => clock }).build();
