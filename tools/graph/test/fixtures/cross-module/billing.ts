// tools/graph/test/fixtures/cross-module/billing.ts
import { DiBag } from '../../../../../src/node';
import type { Shipping } from './shipping.js';
export type Billing = { charge(): string };
export const billingModule = DiBag.createBuilder().register({
  ledger: ({ shipping }: { shipping: Shipping }) => shipping.label(),
  billing: ({ ledger }: { ledger: string }): Billing => ({ charge: () => ledger }),
}).buildModule(['billing']);
