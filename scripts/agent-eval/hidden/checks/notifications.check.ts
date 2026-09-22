// The module installs with fixtures for exactly its contract's requirements and exports its contract.
import { DiBag } from 'di-bag';
import type { MailConfig, Notifier } from '../../src/features/notifications/contract.js';
import { notificationsModule } from '../../src/features/notifications/module.js';

const builder = DiBag.createBuilder()
  .withInstalledModules([notificationsModule])
  .withServices({
    mailConfig: DiBag.withLifetime((): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async () => {}, close: async () => {} }),
    }), 'root'),
  });

builder.verifyGraphAtCompileTime() satisfies void;
export const exported = (): Notifier => builder.buildContainer().resolve('notifier');
