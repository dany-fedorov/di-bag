// tools/graph/test/fixtures/ready-chain.ts
import { DiBag } from '../../../../src';
export const app = DiBag.createBuilder()
  .withServices({
    db: async () => ({ ping: () => true }),
    report: ({ db }: { db: Promise<{ ping(): boolean }> }) => db,
  })
  .buildContainer()
  .ensureServicesReady(['db']);
