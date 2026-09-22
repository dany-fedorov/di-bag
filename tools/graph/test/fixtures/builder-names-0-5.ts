declare const DiBag: any;
declare const clock: any;
declare const events: any;
type Search = { find(query: string): Promise<readonly string[]> };
const retrieval = DiBag.createBuilder().withServices({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule({ exportedServiceKeys: ['retrieve'], moduleLabel: 'retrieval' });
const clocks = DiBag.createBuilder().withTokenService(clock, () => ({ now: () => 0 })).buildModule({ exportedServiceKeys: [clock] });
const modules = [retrieval, clocks] as const;
export const app = DiBag.createBuilder()
  .withInstalledModules(modules)
  .withServices({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve, now }: { retrieve: (question: string) => Promise<readonly string[]>; now: number }) => retrieve,
    leftDependency: () => 1,
    rightDependency: () => 2,
    ordinary: ({ leftDependency }: { leftDependency: number }) => leftDependency,
  })
  .withCollectionContribution({ collectionToken: events, provider: ({ leftDependency }: { leftDependency: number }) => leftDependency })
  .withCollectionContribution({ collectionToken: events, provider: ({ rightDependency }: { rightDependency: number }) => rightDependency })
  .withServiceAlias({ aliasKey: 'now', targetServiceKey: clock })
  .withReplacedService('search', async ({ normalize }: { normalize: unknown }) => ({ find: async () => [] }))
  .buildContainer();
export const inline = DiBag.createBuilder().withInstalledModules([retrieval, clocks]).withServices({ search: (): Search => ({ find: async () => [] }) }).buildContainer();
