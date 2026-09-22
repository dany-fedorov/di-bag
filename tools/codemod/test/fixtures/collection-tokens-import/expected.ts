import { bag, controllers as importedControllers } from '../collection-tokens/input.js';

// The token is declared in another file of the program; its uses here count, and follow its creation.
export const again = bag.resolveCollection(importedControllers);
export const described = bag.inspectCollection(importedControllers).length;
