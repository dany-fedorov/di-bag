import { DiBag } from 'di-bag';
import { options } from './producer.js';

const builder = DiBag.createBuilder().withServices({ value: () => 1 });
export const container = builder.buildContainer().ensureServicesReady(['value'], options);
