// notificationsModule exports `notifier`; the host registers `mailConfig`.

export type OrderPlaced = { orderId: string; totalCents: number };

/** Tells operations about placed orders. */
export type Notifier = { orderPlaced(order: OrderPlaced): Promise<void> };

export type Mail = { to: string; subject: string; body: string };

/** A connection to the mail service. */
export type MailTransport = { send(mail: Mail): Promise<void>; close(): Promise<void> };

/** Registered by the host with root lifetime. `connect` opens a new transport. */
export type MailConfig = { opsAddress: string; connect(): Promise<MailTransport> };

export type NotificationsExports = { notifier: Notifier };
export type NotificationsRequirements = { mailConfig: MailConfig };
