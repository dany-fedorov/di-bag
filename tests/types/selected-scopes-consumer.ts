import { child, grandchild, fork, serviceToken, overriddenRootDependency, childRoot } from './selected-scopes';
import type { Assert, Equal } from './assert';

const config = child.resolve('config');
const token = grandchild.resolve(serviceToken);
const promise = child.resolve('asyncValue');
const metadata = child.inspect('raw').metadata;
type Contracts = [
  Assert<Equal<typeof config, { id: string; added: true }>>,
  Assert<Equal<typeof token, { read: () => number; tokenExtra: 'exact' }>>,
  Assert<Equal<typeof promise, Promise<{ read: () => number; extra(): 'async' }>>>,
  Assert<Equal<typeof metadata, { readonly name: 'raw' }>>,
];
const forkExact: true = fork.resolve('config').added;
const rootId: string = overriddenRootDependency.resolve('service').config.id;
const owned: true = childRoot.resolve('service').owned;
void forkExact; void rootId; void owned;
