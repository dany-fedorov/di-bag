import { DiBag } from 'di-bag';
import type { MailConfig, MailTransport, Notifier } from './contract.js';

export const notificationsModule = DiBag.createBuilder()
  .withServices({
    transport: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: ({ mailConfig }: { mailConfig: MailConfig }) => mailConfig.connect(), disposeService: transport => transport.close() }), lifetime: 'singleton:one-per-container-tree' }),
    notifier: DiBag.providerWithLifetime({ provider: ({ mailConfig, transport }: { mailConfig: MailConfig; transport: Promise<MailTransport> }): Notifier => ({
      async orderPlaced({ orderId, totalCents }) {
        await (await transport).send({ to: mailConfig.opsAddress, subject: `Order ${orderId} placed`, body: `Total: ${totalCents} cents` });
      },
    }), lifetime: 'singleton:one-per-container-tree' }),
  })
  .buildModule({ exportedServiceKeys: ['notifier'], moduleLabel: 'notifications' });
