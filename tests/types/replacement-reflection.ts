import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

export const builder = DiBag.createBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});
export const moduleBuilder = DiBag.createModuleBuilder().register({
  value: () => 1,
  consumer: ({ value }: { value: number }) => value + 1,
});

type IsAny<T> = 0 extends (1 & T) ? true : false;
type FunctionMatch = typeof builder.replace extends (...args: any) => infer R
  ? { matched: true; result: R }
  : { matched: false };
type Utilities = [
  Assert<Equal<FunctionMatch['matched'], true>>,
  Assert<Equal<IsAny<ReturnType<typeof builder.replace>>, false>>,
  Assert<Equal<IsAny<ReturnType<typeof moduleBuilder.replace>>, false>>,
];

export type ModuleView = ReturnType<typeof moduleBuilder.replace>;
export const moduleView: ModuleView = moduleBuilder;
export const feature = moduleView.buildModule(['value', 'consumer']);
export const result = DiBag.createBuilder().installModule(feature).build().resolve('consumer');
type Exact = Assert<Equal<typeof result, number>>;

export const forward = (factory: () => number) => builder.replace('value', factory);
type Forward = Assert<Equal<Parameters<typeof forward>, [factory: () => number]>>;
