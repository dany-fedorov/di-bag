import { DiBag } from './di-bag';

// `clock` exists but with the wrong shape: the `.add` call itself must fail.
const bag = DiBag.begin()
  .add({ clock: () => 'not a clock' })
  .add({
    steps: ({ clock }: { clock: { now: () => number } }) => ({ stamp: () => clock.now() }),
  })
  .end();
export default bag;
