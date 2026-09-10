import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().register({ service: ({ clock }: { clock: number }) => clock }).register({ clock: () => 'wrong' });
