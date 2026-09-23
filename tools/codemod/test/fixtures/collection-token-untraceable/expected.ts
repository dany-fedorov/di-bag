import { DiBag } from 'di-bag';

const inlineKey = Symbol('inline');
const builder = DiBag.createBuilder();
export const inline = builder.withCollectionContribution({ collectionToken: DiBag.createToken(inlineKey).of<number>(), provider: () => 1 });
