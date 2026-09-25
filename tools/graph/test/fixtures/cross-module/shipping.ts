// tools/graph/test/fixtures/cross-module/shipping.ts
import { DiBag } from '../../../../../src';
import type { Billing } from './billing.js';
export type Shipping = { label(): string };
export const shippingModule = DiBag.createBuilder().withServices({
  carrier: ({ billing }: { billing: Billing }) => billing.charge(),
  shipping: ({ carrier }: { carrier: string }): Shipping => ({ label: () => carrier }),
}).buildModule({ exportedServiceKeys: ['shipping'] });
