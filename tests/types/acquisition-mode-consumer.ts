import { rawOwned, nativeOwned, metadata, tokenProvider, projected, framed, capability, bag, token } from './acquisition-mode';
import type { ProviderAcquiredValue, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';
export const selected = bag.resolve(token);
export type Checks = [
  Assert<Equal<ProviderAcquiredValue<typeof rawOwned>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof nativeOwned>, { id: number }>>,
  Assert<Equal<ProviderAcquiredValue<typeof metadata>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof tokenProvider>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof projected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof framed>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof capability>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof rawOwned | typeof nativeOwned>, Promise<{ id: number }> | { id: number }>>,
  Assert<Equal<ProviderOutput<typeof nativeOwned>, typeof selected>>,
];
