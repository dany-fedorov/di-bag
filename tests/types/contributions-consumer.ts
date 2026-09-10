import { DiBag } from '../../src';
import { bag, numbers, contribute, feature } from './contributions';
import type { Assert, Equal } from './assert';
const values = bag.resolveAll(numbers);
export type Exact = Assert<Equal<typeof values, ReadonlyArray<number>>>;
contribute(numbers, () => 4).build();
DiBag.createBuilder().installModule(feature).build().resolveAll(numbers);
import { aggregate, privateHost, needsHost, renamedHost, moduleContribute, key, promiseBag, promised, rootedHelper, allProvider } from './contributions';
needsHost.register({ helper: () => 1 }).build(); privateHost.resolveAll(numbers); renamedHost.resolveAll(numbers);
moduleContribute(numbers, () => 4).register({ helper: () => 1 }).buildModule([]);
// @ts-expect-error exportless contribution dependencies remain required after declaration emission
needsHost.build();
const wrong = DiBag.token(key).of<string>();
// @ts-expect-error present groups validate all references after source deletion
aggregate.contribute(wrong, () => 'wrong');
// @ts-expect-error public export renames retain each contribution's lexical shape
renamedHost.fork(['renamed'], { renamed: () => 'wrong' });
// @ts-expect-error physical reflected callable keeps token output checking
contribute(numbers, () => 'wrong');
const promisedValues = promiseBag.resolveAll(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
// @ts-expect-error contribution lifetime walk survives physical producer emission
rootedHelper.createScope(['helper', 'rootAll'], { helper: () => 2, rootAll: DiBag.withLifetime(allProvider, 'root') });
