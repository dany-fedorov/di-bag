import { DiBag, type RegistrationSnapshot } from '../../src';
import { bag, numbers, contribute, feature, resolveCollectionMethod, collectionSnapshotMethod, serviceSnapshotMethod, renamedFeatureCurrent } from './contributions';
import type { Assert, Equal } from './assert';
const values = bag.resolveCollection(numbers);
const reflectedValues = resolveCollectionMethod(numbers);
const reflectedSnapshots = collectionSnapshotMethod(numbers);
const namedSnapshot = serviceSnapshotMethod('values');
const collectionSnapshots = serviceSnapshotMethod(numbers);
const namedMetadata: object = namedSnapshot.registrationMetadata;
const exactCollectionSnapshots: ReadonlyArray<RegistrationSnapshot<object, readonly unknown[]>> = collectionSnapshots;
const renamedCurrent = DiBag.createBuilder().withInstalledModules([renamedFeatureCurrent]).buildContainer();
const renamedCurrentValue: number = renamedCurrent.resolve('renamedCurrent');
// @ts-expect-error reflected overloads retain the explicit-never rejection after declaration emission
serviceSnapshotMethod<never>(numbers as never);
void namedMetadata; void exactCollectionSnapshots; void renamedCurrentValue;
export type Exact = [Assert<Equal<typeof values, ReadonlyArray<number>>>,
  Assert<Equal<typeof reflectedValues, ReadonlyArray<number>>>,
  Assert<Equal<typeof reflectedSnapshots, ReadonlyArray<RegistrationSnapshot<object, readonly unknown[]>>>>];
contribute({ collectionToken: numbers, provider: () => 4 }).buildContainer();
DiBag.createBuilder().withInstalledModules([feature]).buildContainer().resolveCollection(numbers);
import { aggregate, privateHost, needsHost, renamedHost, moduleContribute, key, promiseBag, promised, rootedHelper, allProvider } from './contributions';
needsHost.withServices({ helper: () => 1 }).buildContainer(); privateHost.resolveCollection(numbers); renamedHost.resolveCollection(numbers);
moduleContribute({ collectionToken: numbers, provider: () => 4 }).withServices({ helper: () => 1 }).buildModule({ exportedServiceKeys: [] });
// @ts-expect-error exportless contribution dependencies remain required after declaration emission
needsHost.buildContainer();
const wrong = DiBag.createToken(key).forCollectionOf<string>();
// @ts-expect-error present groups validate all references after source deletion
aggregate.withCollectionContribution({ collectionToken: wrong, provider: () => 'wrong' });
// @ts-expect-error public export renames retain each contribution's lexical shape
renamedHost.createIndependentContainer(['renamed'], { renamed: () => 'wrong' });
// @ts-expect-error physical reflected callable keeps token output checking
contribute({ collectionToken: numbers, provider: () => 'wrong' });
const promisedValues = promiseBag.resolveCollection(promised);
export type PromiseExact = Assert<Equal<typeof promisedValues, readonly Promise<number>[]>>;
// @ts-expect-error contribution lifetime walk survives physical producer emission
rootedHelper.createChildContainer(['helper', 'rootAll'], { helper: () => 2, rootAll: DiBag.providerWithLifetime({ provider: allProvider, lifetime: 'singleton:one-per-container-tree' }) });
