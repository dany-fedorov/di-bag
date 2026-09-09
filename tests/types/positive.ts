import { DiBag } from '../../src/di-bag';

const bag = DiBag.begin()
  .add({
    result: async ({ value }: { value: Promise<number> }) => (await value) * 2,
  })
  .add({ value: async () => 21, sync: () => 7 })
  .end();
const asyncValue: Promise<number> = bag.resolve('result');
const syncValue: number = bag.resolve('sync');
const forkValue: Promise<number> = bag
  .fork(['value'], { value: async () => 10 })
  .resolve('result');
void [asyncValue, syncValue, forkValue];

const owned = DiBag.begin()
  .add({
    clock: () => 21,
    resource: DiBag.withDisposal(
      async ({ clock }: { clock: number }) => ({ answer: clock * 2 }),
      async (resource) => {
        const answer: number = resource.answer;
        void answer;
      },
    ),
  })
  .end();
const resource: Promise<{ answer: number }> = owned.resolve('resource');
const borrowed: Promise<{ answer: number }> = owned
  .fork(['resource'], {
    resource: async () => ({ answer: 7 }),
  })
  .resolve('resource');
const empty = DiBag.begin().end();
void [resource, borrowed, empty.close()];
