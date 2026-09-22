// Implement the module described in TASK.md. src/app.ts imports `inventoryModule`.
import { DiBag } from 'di-bag';

export const inventoryModule = DiBag.createBuilder().buildModule({ exportedServiceKeys: [] });
