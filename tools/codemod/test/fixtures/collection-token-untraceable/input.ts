import { DiBag } from 'di-bag';

const inlineKey = Symbol('inline');
const builder = DiBag.createBuilder();
export const inline = builder.contribute(DiBag.token(inlineKey).of<number>(), () => 1);
