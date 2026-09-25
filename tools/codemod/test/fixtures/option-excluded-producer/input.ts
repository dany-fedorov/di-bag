import { DiBag } from 'di-bag';
import { options } from './producer.js';

const builder = DiBag.createBuilder().register({ value: () => 1 });
export const container = builder.buildAndStart(['value'], options);
