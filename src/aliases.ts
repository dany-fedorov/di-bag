import { libraryError } from './errors';
import { createProvider } from './provider';
import { retainDescription, sourceDescription } from './provider-operations';
import type { ProviderOrFactory } from './registration';
import type { BindingKey } from './runtime';
import { readSingleServiceKey, readToken } from './tokens';

const collectionAliasLifetime = Object.freeze({
  kind: 'transient' as const,
  allowsScopedDependencies: false,
});

/** Authenticate both selections before constructing any retained registration. */
export function aliasEntry(aliasKey: unknown, targetServiceKey: unknown, hasKey: (key: BindingKey) => boolean): readonly [BindingKey, ProviderOrFactory] {
  const operation = 'withServiceAlias';
  const key = typeof aliasKey === 'string' ? aliasKey : readSingleServiceKey(aliasKey, operation);
  const targetToken = typeof targetServiceKey === 'string' ? undefined : readToken(targetServiceKey);
  const targetKey = targetToken === undefined ? targetServiceKey as string : targetToken.key;
  if (hasKey(key)) throw libraryError('DI_BAG_DUPLICATE_REGISTRATION', `duplicate registration: ${String(key)}`, { operation, key });
  if (typeof targetServiceKey === 'string' && !hasKey(targetKey)) throw libraryError('DI_BAG_INVALID_ALIAS', 'withServiceAlias requires an existing named target', { operation, target: targetKey });
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
        'uninspected',
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
    ...sourceDescription(() => { throw libraryError('DI_BAG_INTERNAL_STATE', 'alias source cannot execute', {}); }, undefined, [], 'uninspected'),
    alias: targetKey,
  }));
  return [key, handle];
}
