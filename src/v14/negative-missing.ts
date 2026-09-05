import { DiBag } from './di-bag';

// `steps` needs `clock`, nobody provides it: `.end` must not be callable.
const bag = DiBag.begin()
  .add({
    steps: ({ clock }: { clock: { now: () => number } }) => ({ stamp: () => clock.now() }),
  })
  .end();
export default bag;
