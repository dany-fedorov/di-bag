import { DiBag } from 'di-bag';
import type { MailConfig, MailTransport, Notifier } from './contract.js';

export const notificationsModule = DiBag.createBuilder()
  .register({
    transport: DiBag.withLifetime(
      DiBag.withDisposal(({ mailConfig }: { mailConfig: MailConfig }) => mailConfig.connect(), transport => transport.close()),
      'root',
    ),
    notifier: DiBag.withLifetime(({ mailConfig, transport }: { mailConfig: MailConfig; transport: Promise<MailTransport> }): Notifier => ({
      async orderPlaced({ orderId, totalCents }) {
        await (await transport).send({ to: mailConfig.opsAddress, subject: `Order ${orderId} placed`, body: `Total: ${totalCents} cents` });
      },
    }), 'root'),
  })
  .buildModule(['notifier'], { label: 'notifications' });
