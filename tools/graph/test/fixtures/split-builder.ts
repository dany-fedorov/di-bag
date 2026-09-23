// tools/graph/test/fixtures/split-builder.ts
import { DiBag } from 'di-bag';
type Search = { find(query: string): Promise<readonly string[]> };
const retrievalModule = DiBag.createBuilder().withServices({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule({ exportedServiceKeys: ['retrieve'] });
const incomplete = DiBag.createBuilder()
  .withInstalledModules([retrievalModule])
  .withServices({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve }: { retrieve: (question: string) => Promise<readonly string[]> }) => retrieve,
  });
export const app = incomplete.withServices({
  db: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: async ({ search }: { search: Search }) => search, disposeService: () => {} }), lifetime: 'singleton:one-per-container-tree' }),
}).buildContainer();
// A bag with a dependency cycle and an unregistered name. The cycle is not a type error; the
// missing name is, and the extractor does not require the fixture to type-check.
// @ts-expect-error missing is not registered
export const cyclic = DiBag.createBuilder().withServices({
  a: ({ b }: { b: number }) => b + 1,
  b: ({ a }: { a: number }) => a + 1,
  lonely: ({ missing }: { missing: string }) => missing,
}).buildContainer();
