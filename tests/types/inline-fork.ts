import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const root = DiBag.begin()
  .add({
    clock: () => ({ now: () => 42 }),
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp: () => clock.now(),
    }),
  })
  .end();

const scoped = root.fork(['clock', 'service'], {
  clock: () => ({
    now() {
      return 7;
    },
  }),
  service: ({ clock }: { clock: { now(): number } }) => ({
    stamp() {
      return clock.now();
    },
    scope() {
      return 'batch' as const;
    },
  }),
});

const service = scoped.resolve('service');
const clock = scoped.resolve('clock');
type Service = Assert<
  Equal<
    typeof service,
    {
      stamp(): number;
      scope(): 'batch';
    }
  >
>;
type Clock = Assert<Equal<typeof clock, { now(): number }>>;

const nested = scoped
  .fork(['clock'], {
    clock() {
      return {
        now() {
          return 3;
        },
      };
    },
  })
  .resolve('service');
type Nested = Assert<Equal<typeof nested, typeof service>>;
