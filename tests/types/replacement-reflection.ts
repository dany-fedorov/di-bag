import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

export const builder = DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
export const moduleBuilder = DiBag.createBuilder().withServices({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});

type IsAny<T> = 0 extends (1 & T) ? true : false;
type FunctionMatch = typeof builder.withReplacedService extends (...args: any) => infer R
  ? { matched: true; result: R }
  : { matched: false };
type Utilities = [
  Assert<Equal<FunctionMatch['matched'], true>>,
  Assert<Equal<IsAny<ReturnType<typeof builder.withReplacedService>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof moduleBuilder.withReplacedService>>, false>>,
];

export type ModuleView = ReturnType<typeof moduleBuilder.withReplacedService>;
export const feature = moduleBuilder.buildModule({ exportedServiceKeys: ['value', 'consumer'] });
export const result = DiBag.createBuilder().withInstalledModules([feature]).buildContainer().resolve('consumer');
type Exact = Assert<Equal<typeof result, number>>;

export const forward = (factory: () => number) => builder.withReplacedService('value', factory);
type Forward = Assert<Equal<Parameters<typeof forward>, [factory: () => number]>>;
