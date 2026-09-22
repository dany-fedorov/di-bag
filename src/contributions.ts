import { normalize } from './registration';
import type { Registration } from './registration';
import { readToken, wrongTokenKind } from './tokens';

/** Authenticate and snapshot one entry before creating its independent binding. */
export function contributionEntry(token: unknown, registration: Registration, operation: 'contribute' | 'withCollectionContribution' = 'contribute'): readonly [symbol, Registration] {
  const { key, kind } = readToken(token);
  if (kind !== 'collection') {
    throw wrongTokenKind(operation, 'collection', key);
  }
  normalize(registration, operation);
  return Object.freeze([key, registration]);
}
