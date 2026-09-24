import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import type { Mail, MailConfig } from './contract.js';
import { notificationsModule } from './module.js';

const fixture = DiBag.createBuilder()
  .withInstalledModules([notificationsModule])
  .withServices({
    mailConfig: DiBag.providerWithLifetime({ provider: (): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => { throw new Error('supply a mail config'); },
    }), lifetime: 'singleton:one-per-container-tree' }),
  })
  .buildContainer();
after(() => fixture.close());

test('mails operations and closes the transport with the application', async () => {
  const events: Array<Mail | 'close'> = [];
  const bag = fixture.createIndependentContainer(['mailConfig'], {
    mailConfig: DiBag.providerWithLifetime({ provider: (): MailConfig => ({
      opsAddress: 'ops@example.com',
      connect: async () => ({ send: async mail => { events.push(mail); }, close: async () => { events.push('close'); } }),
    }), lifetime: 'singleton:one-per-container-tree' }),
  });
  await bag.createChildContainer().resolve('notifier').orderPlaced({ orderId: 'o-1', totalCents: 450 });
  await bag.close();
  assert.deepEqual(events, [{ to: 'ops@example.com', subject: 'Order o-1 placed', body: 'Total: 450 cents' }, 'close']);
});
