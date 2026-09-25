// Implement the module described in TASK.md. src/app.ts imports `checkoutModule`.
import { DiBag } from 'di-bag';

export const checkoutModule = DiBag.createBuilder().buildModule({ exportedServiceKeys: [] });
