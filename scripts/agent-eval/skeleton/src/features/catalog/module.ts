// Implement the module described in TASK.md. src/app.ts imports `catalogModule`.
import { DiBag } from 'di-bag/node';

export const catalogModule = DiBag.createBuilder().buildModule([]);
