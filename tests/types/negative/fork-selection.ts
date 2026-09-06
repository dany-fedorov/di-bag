import { DiBag } from '../../../src';
const root = DiBag.begin().add({ a: () => 1, b: () => 2 }).end();
declare const widened: ('a' | 'b')[];
declare const variadic: readonly ['a', ...'b'[]];
declare const optional: readonly ['a', 'b'?];
declare const union: 'a' | 'b';
declare const template: `a${string}`;
declare const tupleUnion: readonly ['a'] | readonly ['b'];
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork(widened, { a: () => 3, b: () => 4 });
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork(variadic, { a: () => 3, b: () => 4 });
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork(optional, { a: () => 3, b: () => 4 });
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork([union], { a: () => 3, b: () => 4 });
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork([template], { a: () => 3, b: () => 4 });
// diagnostic: fork requires a finite tuple of singleton string-literal keys
root.fork(tupleUnion, { a: () => 3, b: () => 4 });
// diagnostic: Property 'b' is missing
root.fork(['a', 'b'], { a: () => 3 });
// diagnostic: Type 'number' is not assignable to type '(ProviderBase &
root.fork(['a'], { a: 3 });
// diagnostic: No overload expects 1 arguments
root.fork({ a: () => 3 });
