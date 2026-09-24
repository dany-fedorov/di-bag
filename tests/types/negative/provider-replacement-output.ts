import { DiBag } from '../../../src';
DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value,
}).withReplacedService(
  'value',
  // diagnostic: provided service does not satisfy its consumer dependency
  DiBag.createProvider(() => 'wrong'),
);
