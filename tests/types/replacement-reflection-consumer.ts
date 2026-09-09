import { builder, moduleBuilder, result, forward } from './replacement-reflection';
import type { Assert, Equal } from './assert';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type Exact = [
  Assert<Equal<typeof result, number>>,
  Assert<Equal<IsAny<ReturnType<typeof builder.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof moduleBuilder.replace>>, false>>,
  Assert<Equal<Parameters<typeof forward>, [factory: () => number]>>,
];
