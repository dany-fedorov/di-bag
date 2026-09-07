import { rawOwned, nativeOwned, metadata, tokenProvider, projected, framed, capability, bag, token } from './acquisition-mode';
import type { ProviderAcquired, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';
export const selected = bag.resolve(token);
export type Checks = [
  Assert<Equal<ProviderAcquired<typeof rawOwned>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof nativeOwned>, { id: number }>>,
  Assert<Equal<ProviderAcquired<typeof metadata>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof tokenProvider>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof projected>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof framed>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof capability>, Promise<{ id: number }>>>,
  Assert<Equal<ProviderAcquired<typeof rawOwned | typeof nativeOwned>, Promise<{ id: number }> | { id: number }>>,
  Assert<Equal<ProviderOutput<typeof nativeOwned>, typeof selected>>,
];
