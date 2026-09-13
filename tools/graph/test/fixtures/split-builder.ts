// tools/graph/test/fixtures/split-builder.ts
import { DiBag } from '../../../../src/node';
type Search = { find(query: string): Promise<readonly string[]> };
const retrievalModule = DiBag.createBuilder().register({
  normalize: () => (question: string) => question.trim(),
  retrieve: ({ search, normalize }: { search: Search; normalize: (question: string) => string }) => async (question: string) => search.find(normalize(question)),
}).buildModule(['retrieve']);
const incomplete = DiBag.createBuilder()
  .installModule(retrievalModule)
  .register({
    search: (): Search => ({ find: async () => [] }),
    run: ({ retrieve }: { retrieve: (question: string) => Promise<readonly string[]> }) => retrieve,
  });
export const app = incomplete.register({
  db: DiBag.withLifetime(DiBag.withDisposal(async ({ search }: { search: Search }) => search, () => {}), 'root'),
}).build();
// A bag with a dependency cycle and an unregistered name. The cycle is not a type error; the
// missing name is, and the extractor does not require the fixture to type-check.
// @ts-expect-error missing is not registered
export const cyclic = DiBag.createBuilder().register({
  a: ({ b }: { b: number }) => b + 1,
  b: ({ a }: { a: number }) => a + 1,
  lonely: ({ missing }: { missing: string }) => missing,
}).build();
