// Implement the module described in TASK.md. src/app.ts imports `catalogModule`.
import { DiBag } from 'di-bag';

export const catalogModule = DiBag.createBuilder().buildModule({ exportedServiceKeys: [] });
