import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().register({ clock: async () => 1 }).register({ service: ({ clock }: { clock: number }) => clock });
