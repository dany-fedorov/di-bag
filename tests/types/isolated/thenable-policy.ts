import { DiBag } from '../../../src';
// Project-wide opt-out. Compiled in its own program only: the augmentation is global.
declare module '../../../src' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
export const relaxed = DiBag.createBuilder().register({ users: () => new QueryBuilder() });
export const adapter = DiBag.fromFactory(() => new QueryBuilder());
