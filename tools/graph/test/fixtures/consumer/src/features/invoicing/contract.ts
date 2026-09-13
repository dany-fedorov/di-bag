export type Invoicing = { issue(orderId: string, amountCents: number): string };
export type Clock = { now(): number };
