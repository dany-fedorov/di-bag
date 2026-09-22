import { DiBag } from 'di-bag';
import type { MailConfig } from './contract.js';
import { notificationsModule } from './module.js';

DiBag.createBuilder()
  .withInstalledModules([notificationsModule])
  .withServices({
    mailConfig: DiBag.withLifetime((): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async () => {}, close: async () => {} }),
    }), 'root'),
  })
  .verifyGraphAtCompileTime() satisfies void;
