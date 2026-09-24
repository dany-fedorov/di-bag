import { DiBag } from 'di-bag';
const items = DiBag.token(Symbol('items')).of<number>();
export const builder = DiBag.createBuilder()
  .contribute(items, () => 2)
  .replace(items, () => [3]);
