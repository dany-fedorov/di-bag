import { DiBag } from '../../../src/node';
// diagnostic: no exported member
import type { BuilderContribute } from '../../../src';
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
DiBag.createBuilder().withTokenService(number, () => 'wrong');
// diagnostic: does not exist
DiBag.begin();
// diagnostic: does not exist
DiBag.fromTokens([number], (_number: number) => 1);
// diagnostic: does not exist
DiBag.createBuilder().withServices({ value: () => 1 }).buildAndStart(['value']);
// diagnostic: has no exported member
type RemovedStartupOptions = import('../../../src').StartupOptions;
// diagnostic: has no exported member
type RemovedStartupError = import('../../../src').DiBagStartupError;
// diagnostic: has no exported member
type RemovedStartupCancelledError = import('../../../src').DiBagStartupCancelledError;
const removedCollectionKey = Symbol('removed collection');
const removedCollection = DiBag.token(removedCollectionKey).forCollectionOf<number>();
const removedBag = DiBag.createBuilder().withCollectionContribution({ collectionToken: removedCollection, provider: () => 1 }).buildContainer();
// diagnostic: Property 'all' does not exist
DiBag.all(removedCollection);
// diagnostic: Property 'resolveAll' does not exist
removedBag.resolveAll(removedCollection);
// diagnostic: Property 'inspectAll' does not exist
removedBag.inspectAll(removedCollection);
// diagnostic: has no exported member
type RemovedCollectionDependency = import('../../../src').CollectionDependency;

const retiredBuilder = DiBag.createBuilder();
// diagnostic: does not exist
retiredBuilder.register({ value: () => 1 });
// diagnostic: does not exist
retiredBuilder.alias('other', 'value');
// diagnostic: does not exist
retiredBuilder.contribute(number, () => 1);
// diagnostic: does not exist
retiredBuilder.replace('value', () => 2);
// diagnostic: does not exist
retiredBuilder.installModule({});
// diagnostic: does not exist
retiredBuilder.verifyGraph();
// diagnostic: does not exist
retiredBuilder.build();
// diagnostic: exportedServiceKeys
DiBag.createBuilder().withServices({ value: () => 1 }).buildModule(['value']);
