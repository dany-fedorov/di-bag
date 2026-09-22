import { normalize } from './registration';
import type { Registration } from './registration';
import { readToken, wrongTokenKind } from './tokens';

/** Authenticate and snapshot one entry before creating its independent binding. */
export function contributionEntry(collectionToken: unknown, provider: Registration): readonly [symbol, Registration] {
  const operation = 'withCollectionContribution';
  const { key, kind } = readToken(collectionToken);
  if (kind !== 'collection') {
    throw wrongTokenKind(operation, 'collection', key);
  }
  normalize(provider, operation);
  return Object.freeze([key, provider]);
}
