import type { Assert, Equal } from './assert';
import { exactToken, root, child, grandchild } from './scopes';

type SameChild = Assert<Equal<typeof child, typeof root>>;
type SameGrandchild = Assert<Equal<typeof grandchild, typeof root>>;
type NotAny<T> = 0 extends (1 & T) ? false : true;
type ChildIsNotAny = Assert<NotAny<typeof child>>;

const named: Promise<number> = child.resolve('asyncNamed');
const token: { readonly id: 'token'; read(): number } = grandchild.resolve(exactToken);
const raw: Promise<{ id: 'raw' }> = child.resolve('rawOwned');
const renamed: { hidden: true } = child.resolve('renamed');
const owner: 'scope' = grandchild.inspect('rawOwned').registrationMetadata.owner;
void [root, named, token, raw, renamed, owner];
export type Checks = [SameChild, SameGrandchild, ChildIsNotAny];
