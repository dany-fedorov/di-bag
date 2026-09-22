import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DiBag } from 'di-bag';
import { notificationsModule } from '../../src/features/notifications/module.js';

type Event = string | { to: string; subject: string; body: string };

function mailConfig(events: Event[]) {
  return DiBag.withLifetime(() => ({
    opsAddress: 'ops@shop.test',
    connect: async () => {
      events.push('connect');
      return { send: async (mail: Event) => { events.push(mail); }, close: async () => { events.push('close'); } };
    },
  }), 'root');
}
const base = DiBag.createBuilder()
  .withInstalledModules([notificationsModule])
  .withServices({ mailConfig: mailConfig([]) })
  .buildContainer();
after(() => base.close());

const shop = (events: Event[]) => base.fork(['mailConfig'], { mailConfig: mailConfig(events) });

test('orderPlaced mails operations', async () => {
  const events: Event[] = [];
  const bag = shop(events);
  try {
    await bag.createScope().resolve('notifier').orderPlaced({ orderId: 'o-7', totalCents: 2100 });
    assert.deepEqual(events, ['connect', { to: 'ops@shop.test', subject: 'Order o-7 placed', body: 'Total: 2100 cents' }]);
  } finally {
    await bag.close();
  }
});

test('scopes share one transport, closed once with the application and not with a scope', async () => {
  const events: Event[] = [];
  const bag = shop(events);
  const first = bag.createScope();
  const second = bag.createScope();
  await first.resolve('notifier').orderPlaced({ orderId: 'o-1', totalCents: 1 });
  await second.resolve('notifier').orderPlaced({ orderId: 'o-2', totalCents: 2 });
  await first.close();
  await second.close();
  assert.equal(events.filter(event => event === 'connect').length, 1);
  assert.equal(events.includes('close'), false);
  await bag.close();
  assert.deepEqual(events.filter(event => event === 'close'), ['close']);
  assert.equal(events.at(-1), 'close');
});

test('an application that never resolves notifier never connects', async () => {
  const events: Event[] = [];
  const bag = shop(events);
  await bag.createScope().close();
  await bag.close();
  assert.deepEqual(events, []);
});
