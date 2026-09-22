import { DiBag } from '../../../src/di-bag';
// diagnostic: consumer dependency
DiBag.createBuilder().withServices({ clock: () => 1, service: ({ clock }: { clock: number }) => clock }).withReplacedService('clock', () => 'wrong');
