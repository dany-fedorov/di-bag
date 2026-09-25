import { DiBag } from 'di-bag';

export const root = DiBag.createBuilder().register({
  config: DiBag.withLifetime(() => ({ value: 1 }), 'root'),
}).build();
