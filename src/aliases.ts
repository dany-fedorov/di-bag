import { libraryError } from './errors';
import { createProvider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { Registration } from './registration';
import type { BindingKey } from './runtime';
import { readSingleServiceKey, readToken } from './tokens';

const collectionAliasLifetime = Object.freeze({
  kind: 'transient' as const,
  allowScopedDependencies: false,
});

/** Authenticate both selections before constructing any retained registration. */
export function aliasEntry(destination: unknown, target: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, Registration] {
  const key = typeof destination === 'string' ? destination : readSingleServiceKey(destination, 'alias');
  const targetToken = typeof target === 'string' ? undefined : readToken(target);
  const targetKey = targetToken === undefined ? target as string : targetToken.key;
  if (hasKey(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation: 'alias', key });
  if (typeof target === 'string' && !hasKey(targetKey)) throw libraryError('DI_BAG_INVALID_ALIAS', 'alias requires an existing named target', { operation: 'alias', target: targetKey });
  const handle = createProvider();
  if (targetToken?.kind === 'collection') {
    const reference = Object.freeze({
      slot: Symbol('argument'),
      key: targetToken.key,
      kind: 'required' as const,
      isCollection: true,
    });
    retainDescription(handle, Object.freeze({
      ...sourceDescription(
        (dependencies: Record<symbol, unknown>) => Reflect.get(dependencies, reference.slot),
        undefined,
        [targetToken.key],
        'raw',
        false,
        [reference],
      ),
      lifetime: collectionAliasLifetime,
    }));
    return [key, handle];
  }
  // This source is unreachable: canonical routing happens before evaluation.
  // Raw prevents an alias from inventing Promise-classification requirements.
  retainDescription(handle, Object.freeze({
    ...sourceDescription(() => { throw libraryError('DI_BAG_INTERNAL_STATE', 'alias source cannot execute', {}); }, undefined, [], 'raw'),
    alias: targetKey,
  }));
  return [key, handle];
}
