import { root } from './producer.js';

export const child = root.createScope(['config'], { config: () => ({ value: 2 }) });
