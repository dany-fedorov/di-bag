import { DiBag } from '../../src';
import { bag, numbers, contribute, feature } from './contributions';
import type { Assert, Equal } from './assert';
const values = bag.resolveAll(numbers);
export type Exact = Assert<Equal<typeof values, ReadonlyArray<number>>>;
contribute(numbers, () => 4).end();
DiBag.begin().install(feature).end().resolveAll(numbers);
import { aggregate, privateHost, needsHost, renamedHost, moduleContribute, key, promiseBag, promised, rootedHelper, allProvider } from './contributions';
needsHost.add({ helper: () => 1 }).end(); privateHost.resolveAll(numbers); renamedHost.resolveAll(numbers);
moduleContribute(numbers, () => 4).add({ helper: () => 1 }).exports([]);
// @ts-expect-error exportless contribution dependencies remain required after declaration emission
needsHost.end();
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
rootedHelper.scope(['helper', 'rootAll'], { helper: () => 2, rootAll: DiBag.withLifetime(allProvider, 'root') });
