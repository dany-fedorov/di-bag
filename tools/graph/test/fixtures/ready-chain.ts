// tools/graph/test/fixtures/ready-chain.ts
import { DiBag } from '../../../../src/node';
export const app = DiBag.createBuilder()
  .register({
    db: async () => ({ ping: () => true }),
    report: ({ db }: { db: Promise<{ ping(): boolean }> }) => db,
  })
  .build()
  .ensureServicesReady(['db']);
