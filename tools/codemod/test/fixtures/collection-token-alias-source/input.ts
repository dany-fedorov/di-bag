import { DiBag } from 'di-bag';
const importedOnlyItemsKey = Symbol('imported-only-items');
export const importedOnlyItems = DiBag.token(importedOnlyItemsKey).of<number>();
