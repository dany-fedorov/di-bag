import { DiBag } from '../../src/di-bag';

const bag = DiBag.createBuilder().register({
    result: async ({ value }: { value: Promise<number> }) => (await value) * 2,
  }).register({ value: async () => 21, sync: () => 7 }).build();
const asyncValue: Promise<number> = bag.resolve('result');
const syncValue: number = bag.resolve('sync');
const forkValue: Promise<number> = bag.fork(['value'], { value: async () => 10 }).resolve('result');
void [asyncValue, syncValue, forkValue];

const owned = DiBag.createBuilder().register({
    clock: () => 21,
    resource: DiBag.withDisposal(
      async ({ clock }: { clock: number }) => ({ answer: clock * 2 }),
      async (resource) => {
        const answer: number = resource.answer;
        void answer;
      },
    ),
  }).build();
const resource: Promise<{ answer: number }> = owned.resolve('resource');
const borrowed: Promise<{ answer: number }> = owned.fork(['resource'], {
    resource: async () => ({ answer: 7 }),
  }).resolve('resource');
const empty = DiBag.createBuilder().build();
void [resource, borrowed, empty.close()];
