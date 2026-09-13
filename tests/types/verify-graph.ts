import { DiBag } from '../../src';
import type { CompositionReport } from '../../src';
import type { Assert, Equal } from './assert';

const complete = DiBag.createBuilder().register({ config: () => ({ url: 'x' }), db: ({ config }: { config: { url: string } }) => config.url });
complete.verifyGraph() satisfies void;
type CompleteReport = Assert<Equal<CompositionReport<typeof complete>, void>>;

const incomplete = DiBag.createBuilder().register({ db: ({ config }: { config: { url: string } }) => config.url });
type Incomplete = CompositionReport<typeof incomplete>;
type IncompleteNamesTheMissingKey = Assert<Equal<Incomplete extends { missing: infer M } ? M : never, 'config'>>;
type IncompleteKeepsTheRelationship = Assert<Equal<Incomplete extends { relationships: { consumer: infer C } } ? C : never, 'db'>>;

const feature = DiBag.createBuilder().register({ hidden: ({ external }: { external: number }) => external }).buildModule([]);
const installed = DiBag.createBuilder().installModule(feature);
type InstalledReportsTheRequirement = Assert<Equal<CompositionReport<typeof installed> extends { missing: infer M } ? M : never, 'external'>>;
installed.register({ external: () => 1 }).verifyGraph() satisfies void;
export {};
