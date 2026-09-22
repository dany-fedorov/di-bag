import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ service: ({ clock }: { clock: number }) => clock }).withServices({ clock: () => 'wrong' });
