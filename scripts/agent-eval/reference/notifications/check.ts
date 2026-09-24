import { DiBag } from 'di-bag';
import type { MailConfig } from './contract.js';
import { notificationsModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([notificationsModule])
  .withServices({
    mailConfig: DiBag.providerWithLifetime({ provider: (): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async () => {}, close: async () => {} }),
    }), lifetime: 'singleton:one-per-container-tree' }),
  })
  .verifyGraphAtCompileTime() satisfies void;
