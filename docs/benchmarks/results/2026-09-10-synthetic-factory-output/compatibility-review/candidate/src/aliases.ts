import { createProvider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Registration } from './registration';
import type { BindingKey } from './runtime';
import { readTokenKey } from './tokens';

/** Authenticate both selections before constructing any retained registration. */
export function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, Registration] {
  const key = typeof destination === 'string' ? destination : readTokenKey(destination);
  const targetKey = typeof target === 'string' ? target : readTokenKey(target);
  if (hasKey(key)) throw new Error(`duplicate registration: ${String(key)}`);
  if (typeof target === 'string' && !hasKey(targetKey)) throw new Error('alias requires an existing named target');
  const handle = createProvider();
  // This source is unreachable: canonical routing happens before evaluation.
  // Raw prevents an alias from inventing Promise-classification requirements.
  retainDescription(handle, Object.freeze({
    ...sourceDescription(() => { throw new Error('alias source cannot execute'); }, undefined, [], 'raw'),
    alias: targetKey,
  }));
  return [key, handle];
}
