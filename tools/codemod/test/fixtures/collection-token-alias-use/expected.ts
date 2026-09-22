import { DiBag } from 'di-bag';
import { importedOnlyItems as localItems } from '../collection-token-alias-source/input.js';
const app = DiBag.createBuilder().withCollectionContribution({ collectionToken: localItems, provider: () => 1 }).buildContainer();
export const items = app.resolveCollection(localItems);
