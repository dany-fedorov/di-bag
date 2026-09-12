import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DiBag } from '../../src/node';
import { diagnostics } from '../../tests/compiler';

const source = `import { DiBag } from '../src/node';
const bag = DiBag.createBuilder().register({
  a: ({ b }: { b: number }): number => b,
  b: ({ a }: { a: number }): number => a,
}).build();`;
const virtualPath = fileURLToPath(new URL('../../tests/audit-virtual.ts', import.meta.url));
const errors = diagnostics(virtualPath, source);
assert.equal(errors.length, 0);
const cyclic = DiBag.createBuilder().register({
  a: ({ b }: { b: number }): number => b,
  b: ({ a }: { a: number }): number => a,
}).build();
assert.throws(() => cyclic.resolve('a'), /cycle/i);
await cyclic.close();

const events: Array<{ kind: string }> = [];
const configured = DiBag.withConfiguration({ observers: [{
  onEvent: event => { events.push(event); },
  onError: error => { throw error; },
}] });
let calls = 0;
const bag = configured.createBuilder().register({ node: () => () => ++calls }).build();
const node = bag.resolve('node');
await Promise.resolve();
const afterAcquisition = events.length;
assert.equal(node(), 1);
assert.equal(node(), 2);
await Promise.resolve();
assert.equal(events.length, afterAcquisition);
assert.deepEqual(Object.keys(bag.inspect('node')).sort(),
  ['acquisitions', 'bindingId', 'label', 'registrationMetadata']);
await bag.close();

const shared = { count: 0 };
const original = DiBag.createBuilder().register({ config: () => shared }).build();
const fork = original.fork();
assert.equal(original.resolve('config'), fork.resolve('config'));
fork.resolve('config').count++;
assert.equal(original.resolve('config').count, 1);
await fork.close(); await original.close();

let effects = 0;
const commands = DiBag.createBuilder().register({
  action: async () => ++effects,
}).build();
const one = commands.resolve('action');
assert.equal(commands.resolve('action'), one);
assert.equal(await one, 1);
const branch = commands.fork();
assert.equal(await branch.resolve('action'), 2);
await branch.close(); await commands.close();

let unused = 0;
const conditional = DiBag.createBuilder().register({
  left: () => 'L', right: () => { unused++; return 'R'; },
  pick: (deps: { left: string; right: string }) => deps.left,
}).build();
assert.equal(conditional.resolve('pick'), 'L');
assert.equal(unused, 0);
assert.equal(conditional.inspect('right').acquisitions.length, 0);
await conditional.close();

let release!: () => void;
const gate = new Promise<void>(resolve => { release = resolve; });
let finished = false;
const active = DiBag.createBuilder().register({
  node: () => async () => { await gate; finished = true; },
}).build();
const work = active.resolve('node')();
await active.close();
assert.equal(finished, false);
release(); await work;
console.log(JSON.stringify({
  cycleTypeDiagnostics: errors.length, cycleRejectedAtResolve: true,
  nodeInvocations: calls, invocationEventsAdded: 0,
  inspectHasDependencyEdges: false, forkSharesClosureObject: true,
  actionEffectsAfterRepeatedResolveAndFork: effects,
  declaredButUnreadDependencyAcquisitions: unused,
  bagClosedBeforeNodeInvocationFinished: true,
}));
