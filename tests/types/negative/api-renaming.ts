import { DiBag } from '../../../src/node';
const base = DiBag.fromFactory(() => Promise.resolve(1), { acquisitionMode: 'raw' });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { describe: (_value: Promise<number>) => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { mode: 'direct', describe: async () => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, { dynamic: { mode: 'awaited', describe: async () => ({}) } });
// diagnostic: No overload matches
DiBag.withMetadata(base, {});
// diagnostic: No overload matches
DiBag.withMetadata(DiBag.withMetadata(base, { static: { owner: 1 } }), { static: { owner: 2 } });
// diagnostic: No overload matches
DiBag.transformService(base, { mode: 'awaited', acquisitionMode: 'raw', transform: value => value });
// diagnostic: No overload matches
DiBag.fromFactory(() => 1, { acquisitionMode: 'nativePromise' });
// diagnostic: not assignable
DiBag.fromFactory((_deps: {}, _context: { signal: AbortSignal }) => 1);
// diagnostic: No overload matches
DiBag.transformService(base, { mode: 'direct', acquisitionMode: 'nativePromise', transform: () => 1 });
const numberKey = Symbol('number');
const number = DiBag.token(numberKey).of<number>();
// diagnostic: composition arguments must match the declared parameter tuple
DiBag.fromFunction([number], () => 1);
// diagnostic: token binding output is not assignable to its service
DiBag.createBuilder().register(number, () => 'wrong');
// diagnostic: does not exist
DiBag.begin();
// diagnostic: does not exist
DiBag.fromTokens([number], (_number: number) => 1);
