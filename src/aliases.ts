import { libraryError } from './errors';
import { createProvider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Registration } from './registration';
import type { BindingKey } from './runtime';
import { readTokenKey } from './tokens';

/** Authenticate both selections before constructing any retained registration. */
export function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, Registration] {
  const key = typeof destination === 'string' ? destination : readTokenKey(destination);
  const targetKey = typeof target === 'string' ? target : readTokenKey(target);
  if (hasKey(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'alias', key });
  if (typeof target === 'string' && !hasKey(targetKey)) throw libraryError('DI_BAG_INVALID_ALIAS', 'alias requires an existing named target', { operation: 'alias', target: targetKey });
  const handle = createProvider();
  // This source is unreachable: canonical routing happens before evaluation.
  // Raw prevents an alias from inventing Promise-classification requirements.
  retainDescription(handle, Object.freeze({
    ...sourceDescription(() => { throw libraryError('DI_BAG_INTERNAL_STATE', 'alias source cannot execute', {}); }, undefined, [], 'raw'),
    alias: targetKey,
  }));
  return [key, handle];
}
