import { DiBag } from 'di-bag';
import { importedOnlyItems as localItems } from '../collection-token-alias-source/input.js';
const app = DiBag.createBuilder().contribute(localItems, () => 1).build();
export const items = app.resolveCollection(localItems);
