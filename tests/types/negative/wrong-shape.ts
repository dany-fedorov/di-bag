import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().register({ clock: () => 'wrong' }).register({ service: ({ clock }: { clock: number }) => clock });
