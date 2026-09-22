declare const DiBag: any;
declare const clock: any;
declare const events: any;
type Search = { find(query: string): Promise<readonly string[]> };
const retrieval = DiBag.createBuilder().register({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule(['retrieve'], { label: 'retrieval' });
const clocks = DiBag.createBuilder().register(clock, () => ({ now: () => 0 })).buildModule([clock]);
export const app = DiBag.createBuilder()
  .installModule(retrieval)
  .installModule(clocks)
  .register({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve, now }: { retrieve: (question: string) => Promise<readonly string[]>; now: number }) => retrieve,
    leftDependency: () => 1,
    rightDependency: () => 2,
    ordinary: ({ leftDependency }: { leftDependency: number }) => leftDependency,
  })
  .contribute(events, ({ leftDependency }: { leftDependency: number }) => leftDependency)
  .contribute(events, ({ rightDependency }: { rightDependency: number }) => rightDependency)
  .alias('now', clock)
  .replace('search', async ({ normalize }: { normalize: unknown }) => ({ find: async () => [] }))
  .build();
