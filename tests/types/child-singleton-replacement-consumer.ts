import { items, repeatedCollectionChild } from './child-singleton-replacement';

const values: readonly number[] = repeatedCollectionChild.resolveCollection(items);
void values;
