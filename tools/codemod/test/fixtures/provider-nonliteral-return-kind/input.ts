import { DiBag } from 'di-bag';
const mode = 'raw' as const;
const pending = Promise.resolve(1);
export const factory = DiBag.fromFactory(() => pending, { acquisitionMode: mode });
export const functionProvider = DiBag.fromFunction([], () => 1, { acquisitionMode: mode });
export const classProvider = DiBag.fromClass([], class Service {}, { acquisitionMode: mode });
export const pluginProvider = DiBag.fromPlugin([], { apiVersion: 1, create: () => 1 }, { acquisitionMode: mode, validate: (value): value is number => typeof value === 'number' });
