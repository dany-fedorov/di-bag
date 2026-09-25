import { root } from './producer.js';

export const child = root.createChildContainer(['config'], { config: () => ({ value: 2 }) });
