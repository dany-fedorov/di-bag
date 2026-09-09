import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

const bag = DiBag.begin()
  .add({
    clock: () => ({
      now() {
        return 42;
      },
    }),
    resource: DiBag.withDisposal(
      async ({ clock }: { clock: { now(): number } }) => ({
        stamp() {
          return clock.now();
        },
        close() {},
      }),
      (resource) => {
        type Resource = Assert<
          Equal<
            typeof resource,
            {
              stamp(): number;
              close(): void;
            }
          >
        >;
        resource.close();
      },
    ),
  })
  .end();

const resource = bag.resolve('resource');
type Resource = Assert<
  Equal<
    typeof resource,
    Promise<{
      stamp(): number;
      close(): void;
    }>
  >
>;

const borrowed = bag
  .fork(['resource'], {
    resource: async () => ({
      stamp() {
        return 7;
      },
      close() {},
    }),
  })
  .resolve('resource');
type Borrowed = Assert<Equal<typeof borrowed, typeof resource>>;
