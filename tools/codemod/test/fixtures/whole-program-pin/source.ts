import { DiBag } from 'di-bag';
export const container = DiBag.createBuilder().register({ value: () => 1 }).build();
