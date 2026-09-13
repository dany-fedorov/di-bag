import { DiBag } from 'di-bag/node';
import type { MailConfig } from './contract.js';
import { notificationsModule } from './module.js';

DiBag.createBuilder()
  .installModule(notificationsModule)
  .register({
    mailConfig: DiBag.withLifetime((): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async () => {}, close: async () => {} }),
    }), 'root'),
  })
  .verifyGraph() satisfies void;
