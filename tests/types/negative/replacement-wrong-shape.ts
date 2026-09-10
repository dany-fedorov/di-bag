import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().register({ clock: () => 1, service: ({ clock }: { clock: number }) => clock }).replace('clock', () => 'wrong');
