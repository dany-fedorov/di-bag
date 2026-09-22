import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ clock: () => 'wrong' }).withServices({ service: ({ clock }: { clock: number }) => clock });
