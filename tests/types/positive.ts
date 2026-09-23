import { DiBag } from '../../src/di-bag';

const bag = DiBag.createBuilder().withServices({
    result: async ({ value }: { value: Promise<number> }) => (await value) * 2,
  }).withServices({ value: async () => 21, sync: () => 7 }).buildContainer();
const asyncValue: Promise<number> = bag.resolve('result');
const syncValue: number = bag.resolve('sync');
const forkValue: Promise<number> = bag.createIndependentContainer(['value'], { value: async () => 10 }).resolve('result');
void [asyncValue, syncValue, forkValue];

const owned = DiBag.createBuilder().withServices({
    clock: () => 21,
    resource: DiBag.providerWithDisposal({ provider: async ({ clock }: { clock: number }) => ({ answer: clock * 2 }), disposeService: async (resource) => {
        const answer: number = resource.answer;
        void answer;
      } }),
  }).buildContainer();
const resource: Promise<{ answer: number }> = owned.resolve('resource');
const borrowed: Promise<{ answer: number }> = owned.createIndependentContainer(['resource'], {
    resource: async () => ({ answer: 7 }),
  }).resolve('resource');
const empty = DiBag.createBuilder().buildContainer();
void [resource, borrowed, empty.close()];
