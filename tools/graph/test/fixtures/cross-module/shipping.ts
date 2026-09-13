// tools/graph/test/fixtures/cross-module/shipping.ts
import { DiBag } from '../../../../../src/node';
import type { Billing } from './billing.js';
export type Shipping = { label(): string };
export const shippingModule = DiBag.createBuilder().register({
  carrier: ({ billing }: { billing: Billing }) => billing.charge(),
  shipping: ({ carrier }: { carrier: string }): Shipping => ({ label: () => carrier }),
}).buildModule(['shipping']);
