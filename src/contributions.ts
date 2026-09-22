import { normalize } from './registration';
import type { Registration } from './registration';
import { readToken, wrongTokenKind } from './tokens';

/** Authenticate and snapshot one entry before creating its independent binding. */
export function contributionEntry(token: unknown, registration: Registration): readonly [symbol, Registration] {
  const { key, kind } = readToken(token);
  if (kind !== 'collection') {
    throw wrongTokenKind('contribute', 'collection', key);
  }
  normalize(registration);
  return Object.freeze([key, registration]);
}
