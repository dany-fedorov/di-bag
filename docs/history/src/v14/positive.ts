import { DiBag } from './di-bag';

// Requirements inferred from parameters, nothing declared twice.
const bag = DiBag.begin()
  .add({
    clock: () => ({ now: (): number => 42 }),
    digest: () => ({ sha256: (s: string) => `sha:${s}` }),
  })
  .add({
    steps: ({ clock }: { clock: { now: () => number } }) => ({ stamp: () => clock.now() }),
    savedPlan: ({ digest, steps }: { digest: { sha256: (s: string) => string }; steps: { stamp: () => number } }) =>
      digest.sha256(String(steps.stamp())),
  })
  .end();

const saved: string = bag.resolve('savedPlan');
const stamp: number = bag.resolve('steps').stamp();
// fork: the batch scope replaces one token, the rest of the graph follows.
const forked = bag.fork({ clock: () => ({ now: () => 7 }) });
const fromFork: number = forked.resolve('steps').stamp();
console.log(JSON.stringify({ saved, stamp, fromFork, sameMemo: bag.resolve('steps') === bag.resolve('steps') }));

// Runtime cycle detection.
const cyclic = DiBag.begin()
  .add({
    a: ({ b }: { b: number }) => b + 1,
    b: ({ a }: { a: number }) => a + 1,
  })
  .end();
try {
  cyclic.resolve('a');
  console.log('NO CYCLE THROWN');
} catch (e) {
  console.log((e as Error).message);
}
