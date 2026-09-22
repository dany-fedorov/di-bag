import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ clock: async () => 1 }).withServices({ service: ({ clock }: { clock: number }) => clock });
