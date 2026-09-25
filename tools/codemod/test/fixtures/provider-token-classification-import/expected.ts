import { aliasOnly as importedList, bag } from '../provider-token-classification/input.js';
export const imported = bag.resolveCollection(importedList);
export const described = bag.serviceSnapshot(importedList);
