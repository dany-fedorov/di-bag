import { DiBag as DI } from 'di-bag';

const toolsKey = Symbol('tools');
const tools = DI.token(toolsKey).of<string>();

const Observed = DI.withConfiguration({ observers: [] });

const builder = Observed.createBuilder()
  .register({ greeting: DI.fromFactory(() => 'hello', { acquisitionMode: 'raw' }) })
  // A comment inside the chain survives.
  .contribute(tools, () => 'search');

builder.verifyGraph() satisfies void;

export const bag = builder.build();
export const copy = bag.fork();
export const labels = bag?.inspectGraph().bindings.map(binding => binding.label);

// A reference that is not a call is renamed when the map only renames.
export const buildLater = builder.build;
export const { inspectGraph } = bag;
export const { inspectGraph: snapshotGraph } = bag;
