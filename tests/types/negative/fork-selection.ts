import { DiBag } from '../../../src';
const root = DiBag.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildContainer();
declare const widened: ('a' | 'b')[];
declare const variadic: readonly ['a', ...'b'[]];
declare const optional: readonly ['a', 'b'?];
declare const union: 'a' | 'b';
declare const template: `a${string}`;
declare const tupleUnion: readonly ['a'] | readonly ['b'];
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer(widened, { a: () => 3, b: () => 4 });
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer(variadic, { a: () => 3, b: () => 4 });
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer(optional, { a: () => 3, b: () => 4 });
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer([union], { a: () => 3, b: () => 4 });
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer([template], { a: () => 3, b: () => 4 });
// diagnostic: createIndependentContainer requires a finite tuple of singleton string-literal names or typed tokens; see https://dany-fedorov.github.io/di-bag/agent/errors.html#unknown-key
root.createIndependentContainer(tupleUnion, { a: () => 3, b: () => 4 });
// diagnostic: Property 'b' is missing
root.createIndependentContainer(['a', 'b'], { a: () => 3 });
// diagnostic: Type 'number' is not assignable to type
root.createIndependentContainer(['a'], { a: 3 });
// diagnostic: Object literal may only specify known properties
root.createIndependentContainer({ a: () => 3 });
