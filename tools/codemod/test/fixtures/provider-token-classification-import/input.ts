import { aliasOnly as importedList, bag } from '../provider-token-classification/input.js';
export const imported = bag.resolveAll(importedList);
export const described = bag.inspectAll(importedList);
