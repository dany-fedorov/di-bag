import { normalize } from './registration';
import type { Registration } from './registration';
import { readTokenKey } from './tokens';

/** Authenticate and snapshot one entry before creating its independent binding. */
export function contributionEntry(token: unknown, registration: Registration): readonly [symbol, Registration] {
  const key = readTokenKey(token);
  normalize(registration);
  return Object.freeze([key, registration]);
}
