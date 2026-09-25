import { DiBag as DI } from 'di-bag';

const toolsKey = Symbol('tools');
const tools = DI.token(toolsKey).of<string>();

const Observed = DI.withConfiguration({ observers: [] });

const builder = Observed.createBuilder()
  .withServices({ greeting: DI.createProvider(() => 'hello', { acquisitionMode: 'raw' }) })
  // A comment inside the chain survives.
  .withCollectionContribution(tools, () => 'search');

builder.verifyGraphAtCompileTime() satisfies void;

export const bag = builder.buildContainer();
export const copy = bag.createIndependentContainer();
export const labels = bag?.graphSnapshot().bindings.map(binding => binding.label);

// A reference that is not a call is renamed when the map only renames.
export const buildLater = builder.buildContainer;
export const { graphSnapshot: inspectGraph } = bag;
export const { graphSnapshot: snapshotGraph } = bag;
