import { DiBag } from '../../../src/di-bag';
// diagnostic: wrong shape
// diagnostic-native-gap: last-token-string
DiBag.begin()
  .add({ clock: () => 1, service: ({ clock }: { clock: number }) => clock })
  .replace('clock', () => 'wrong');
